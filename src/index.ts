import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  JupyterLab
} from "@jupyterlab/application";

import {
  IDocumentManager
} from "@jupyterlab/docmanager";

import {
  INotebookTracker,
  NotebookPanel,
  INotebookModel,
  Notebook,
  NotebookActions
} from "@jupyterlab/notebook";

import {
  Cell,
  CodeCell,
  ICellModel
} from "@jupyterlab/cells";

import {
  IObservableList,
  IObservableUndoableList,
  IObservableString
} from "@jupyterlab/observables";

import { IOutputAreaModel } from "@jupyterlab/outputarea";

import { INotebookContent } from "@jupyterlab/nbformat";

import {
  DocumentRegistry
} from "@jupyterlab/docregistry";

import {
  requestAPI
} from "./handler";

import {
  AWSAPIGatewayHandler
} from "./aws_api_gateway_handler"

import {
  ICellMeta,
  IHandler
} from "./types";

import {
  OpenNotebookEvent,
  CellsChangedEvent,
  SaveNotebookEvent,
  CellExecutedEvent,
  ScrollEvent,
  ActiveCellChangedEvent
} from "./events"
import { ISettingRegistry } from "@jupyterlab/settingregistry";


export class EventMessageHandler {

  private _notebookState;
  private _handler: IHandler;
  private _id: string
  private _seq: number;

  constructor(
    { notebookState, handler, id }:
      { notebookState: NotebookState, handler: IHandler, id: string }
  ) {

    this._notebookState = notebookState;
    this._handler = handler;
    this._id = id;
    this._seq = 0;

    this.message = this.message.bind(this);
  }

  async message(name: string, cells: Array<any>) {

    try {

      let notebook = this._notebookState.notebook;
      let cellState = this._notebookState.cellState;

      let nbFormatNotebook = (notebook.model.toJSON() as INotebookContent);

      for (let index = 0; index < this._notebookState.notebook.widgets.length; index++) {

        let cell: Cell<ICellModel> = this._notebookState.notebook.widgets[index];

        if (cellState.get(cell).changed === false) {
          //  The cell has not changed; hence, the notebook format cell will contain just its id.

          (nbFormatNotebook.cells[index] as any) = { id: nbFormatNotebook.cells[index].id };
        }
      }

      this._seq = this._seq + 1;

      let message = {
        name: name,
        notebook: nbFormatNotebook,
        cells: cells,
        id: this._id,
        seq: this._seq
      }

      this._notebookState.notebook.widgets.forEach((cell: Cell<ICellModel>) => {
        cellState.get(cell).changed = false;
        //  The cell state has been captured; hence, set all states to not changed.
      });

      console.log(message);

      await this._handler.handle(message);

    }
    catch (e) {
      console.error(e);

      setTimeout(this.message, 1000, name, cells);
    }
  }
}

class NotebookState {

  public notebook: Notebook;
  public cellState: WeakMap<Cell<ICellModel>, { changed: boolean, output: string }>;

  constructor({ notebook }: { notebook: Notebook }) {

    this.notebook = notebook;
    this.cellState = new WeakMap<Cell<ICellModel>, { changed: boolean, output: string }>();

    this.updateCellState = this.updateCellState.bind(this);

    this.updateCellState();
    //  The notebook loaded; hence, we update the cell state.

    this.notebook.model.cells.changed.connect((
      sender: IObservableUndoableList<ICellModel>,
      args: IObservableList.IChangedArgs<ICellModel>
    ) => {

      if (args.type == "add") {

        this.updateCellState();
        //  A cell was added; hence, we update the cell state.
      }
    }, this);
  }

  updateCellState() {

    this.notebook.widgets.forEach((cell: Cell<ICellModel>) => {

      if (!this.cellState.has(cell)) {

        this.cellState.set(cell, { changed: true, output: this.cellOutput(cell) });
        //  It's a new cell; hence, the changed state is set to true.

        ////  This is a new cell; hence, add handlers that check for changes in the inputs and outputs.
        cell.inputArea.model.value.changed.connect(
          (sender: IObservableString, args: IObservableString.IChangedArgs) => {
            let state = this.cellState.get(cell);
            state.changed = true;
            //  The input area changed; hence, the changed state is set to true.
          });

        if (cell.model.type == "code") {

          (cell as CodeCell).model.outputs.changed.connect(
            (sender: IOutputAreaModel, args: IOutputAreaModel.ChangedArgs
            ) => {
              if (args.type == "add") {
                //  An output has been added to the cell; hence, compare the current state with the new state.
                let state = this.cellState.get(cell);
                let output = this.cellOutput(cell);
                if (output !== state.output) {
                  //  The output has changed; hence, set changed to true and update the output state.
                  state.changed = true;
                  state.output = output;
                }
                else {
                  //  The output hasn't changed; hence, leave the state as is.
                }
              }
            });
        }
      }
    });
  }

  cellOutput(cell: Cell<ICellModel>) {

    let output = "";

    if (cell.model.type == "code") {

      let outputs = (cell as CodeCell).model.outputs;

      for (let index = 0; index < outputs.length; index++) {

        for (let key of Object.keys(outputs.get(index).data).sort()) {
          output = output + JSON.stringify(outputs.get(index).data[key]);
        }
      }
      return output;
    }

    return "";
  }
}

const PLUGIN_ID = 'etc-jupyterlab-telemetry:plugin';

/**
 * Initialization data for the etc-jupyterlab-telemetry extension.
 */
const extension: JupyterFrontEndPlugin<object> = {
  id: PLUGIN_ID,
  autoStart: true,
  requires: [
    INotebookTracker,
    IDocumentManager,
    ISettingRegistry
  ],
  activate: (
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    documentManager: IDocumentManager,
    settingRegistry: ISettingRegistry
  ) => {
    console.log("JupyterLab extension etc-jupyterlab-telemetry is activated!");


    (async function () {
      
      await app.restored;

      let settings: ISettingRegistry.ISettings = await settingRegistry.load(PLUGIN_ID);
      
      console.log(settings.composite);

      let handler: IHandler;

      handler = new AWSAPIGatewayHandler({
        url: "https://telemetry.mentoracademy.org",
        bucket: "telemetry-s3-aws-edtech-labs-si-umich-edu",
        path: "refactor-test"
      });

      let resource: string = "id";
      let id: string;

      try { // to get the user id.
        id = await requestAPI<any>(resource);
      } catch (reason) {

        console.error(`Error on GET /etc-jupyterlab-telemetry/${resource}.\n${reason}`);
      }

      notebookTracker.widgetAdded.connect(async (sender: INotebookTracker, notebookPanel: NotebookPanel) => {

        await notebookPanel.revealed;
        await notebookPanel.sessionContext.ready;

        let notebookState = new NotebookState({ notebook: notebookPanel.content });

        let eventMessageHandler = new EventMessageHandler({ notebookState, handler, id });

        new OpenNotebookEvent({ notebook: notebookPanel.content, handler: eventMessageHandler })
        new CellsChangedEvent({ notebook: notebookPanel.content, handler: eventMessageHandler });
        new SaveNotebookEvent({ notebookPanel: notebookPanel, handler: eventMessageHandler });
        new CellExecutedEvent({ notebook: notebookPanel.content, handler: eventMessageHandler });
        new ScrollEvent({ notebook: notebookPanel.content, handler: eventMessageHandler });
        new ActiveCellChangedEvent({ notebook: notebookPanel.content, handler: eventMessageHandler });

      });
    })();

    return {};
  }
};

export default extension;

