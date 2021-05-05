import {
  ConnectionLost,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from "@jupyterlab/application";

import { UUID } from '@lumino/coreutils';

import {
  IConnectionLost,
  ILabStatus,
  ILabShell,
  ILayoutRestorer,
  IMimeDocumentTracker,
  IRouter,
  JupyterLab
} from "@jupyterlab/application";

import {
  ICommandPalette,
  ISplashScreen,
  IThemeManager,
  IWindowResolver,
  ISessionContext
} from "@jupyterlab/apputils";

import {
  IEditorServices
} from "@jupyterlab/codeeditor";

import {
  IConsoleTracker
} from "@jupyterlab/console";

import {
  IDocumentManager
} from "@jupyterlab/docmanager";
import { ISettingRegistry } from "@jupyterlab/settingregistry";
import { each } from "@lumino/algorithm";
import { CommandRegistry } from "@lumino/commands";
import { ISignal, Signal, Slot } from "@lumino/signaling";
import { PartialJSONValue } from '@lumino/coreutils';
import { INotebookTracker, NotebookPanel, INotebookModel, Notebook, NotebookModel, CellTypeSwitcher } from "@jupyterlab/notebook";
import { NotebookActions } from '@jupyterlab/notebook';
import { Cell, CodeCell, CodeCellModel, ICellModel, ICodeCellModel } from "@jupyterlab/cells";
import { Session, Kernel } from '@jupyterlab/services';
import { JSONExt, JSONObject, ReadonlyPartialJSONObject } from "@lumino/coreutils";
import { Widget } from "@lumino/widgets";
import {
  IObservableJSON,
  IObservableList,
  IObservableUndoableList
} from "@jupyterlab/observables";
import { IChangedArgs } from "@jupyterlab/coreutils";
import { DocumentRegistry } from "@jupyterlab/docregistry";
import { Contents } from '@jupyterlab/services';
import { URLExt } from "@jupyterlab/coreutils";
import { ServerConnection } from "@jupyterlab/services";
import { requestAPI } from './handler';
import { ICellMeta, IEventMessage, IHandler } from './types';
import { AWSAPIGatewayHandler } from './aws_api_gateway_handler'
import { IObservableString } from '@jupyterlab/observables';
import { IOutputAreaModel } from '@jupyterlab/outputarea';
import { IOutputModel } from '@jupyterlab/rendermime';
import * as nbformat from '@jupyterlab/nbformat';

// interface INotebookPanelWrapperOptions {
//   notebookPanel: NotebookPanel;
//   id: string | null;
// }

// class NotebookPanelWrapper {

//   private notebookPanel: NotebookPanel;
//   private cells: IObservableUndoableList<ICellModel>;
//   private user: string | null;
//   private scrollTimeoutId: number;
//   private notebookNode: HTMLElement;
//   private contentChanged: boolean;
//   private notebookUUID: string;

//   constructor({ notebookPanel, id = null }: INotebookPanelWrapperOptions) {

//     this.notebookUUID = UUID.uuid4();
//     this.contentChanged = true;

//     this.user = id;
//     this.notebookPanel = notebookPanel;
//     this.cells = notebookPanel.model.cells;
//     this.notebookNode = this.notebookPanel.content.node;

//     this.notebookPanel.disposed.connect(this.dispose, this);

//     notebookPanel.model.contentChanged.connect((notebookModel: INotebookModel, _: void) => {
//       this.contentChanged = true;
//     });

//     //
//     this.notebookPanel.content.model.cells.changed.connect(this.cellsChanged, this);
//     this.notebookPanel.context.saveState.connect(this.saveState, this);
//     NotebookActions.executed.connect(this.executed, this);
//     this.notebookPanel.content.activeCellChanged.connect(this.activeCellChanged, this);
//     setTimeout(this.firstRender.bind(this));
//     // Recorded Events.
//   }

//   private dispose() {

//     // NotebookActions.executed.disconnect(this.executed, this);

//     delete this.cells;

//     console.log(`${this.notebookPanel.context.path} disposed.`);

//     delete this.notebookPanel;
//   }

//   private async event(eventName: string, cellIds: Array<ICellMeta>) {

//     try {

//       let eventMessage: IEventMessage;

//       if (this.contentChanged) {
//         this.contentChanged = false;
//         this.notebookUUID = UUID.uuid4();

//         eventMessage = {
//           eventName,
//           notebookUUID: this.notebookUUID,
//           notebook: this.notebookPanel.model,
//           cellIds,
//           user: this.user
//         }
//       }
//       else {
//         eventMessage = {
//           eventName,
//           notebookUUID: this.notebookUUID,
//           cellIds,
//           user: this.user
//         }
//       }

//       console.log("JSON.stringify(eventMessage): ", JSON.stringify(eventMessage));

//       // let response = await fetch("", {
//       //   method: "POST",
//       //   mode: "cors",
//       //   cache: "no-cache",
//       //   headers: {
//       //     "Content-Type": "application/json"
//       //   },
//       //   redirect: "follow",
//       //   referrerPolicy: "no-referrer",
//       //   body: JSON.stringify(eventMessage)
//       // });

//       // if (response.status !== 200) {

//       //   throw new Error(JSON.stringify({
//       //     "response.status": response.status,
//       //     "response.statusText": response.statusText,
//       //     "response.text()": await response.text()
//       //   }));
//       // }
//     }
//     catch (e) {
//       console.error(e);
//     }
//   }

//   visibleCellIds() {


//   }

//   cellIndexOf(cellModel: ICellModel) {

//     let index: number;

//     for (index = 0; index < this.cells.length; index++) {
//       if (cellModel === this.cells.get(index)) {
//         return index;
//       }
//     }
//   }

//   /* Event Handlers */

//   activeCellChanged(notebook: Notebook, cell: Cell<ICellModel>) {

//     this.event("active_cell_changed", [
//       {
//         id: cell.model.id,
//         index: this.cellIndexOf(cell.model)
//       }
//     ]);
//   }

//   firstRender() {

//     let cellIds: Array<ICellMeta>;

//     cellIds = this.visibleCellIds();

//     this.event("first_render", cellIds);
//   }





// }



class EventMessageHandler {

  private _notebookState;

  constructor(
    { notebookState }:
      { notebookState: NotebookState }
  ) {

    this._notebookState = notebookState;
  }

  async message(name: string, metas: Array<any>) {

    try {

      let notebook = this._notebookState.notebook;
      let cellState = this._notebookState.cellState;

      let nbFormatNotebook = (notebook.model.toJSON() as nbformat.INotebookContent);

      for (let index = 0; index < this._notebookState.notebook.widgets.length; index++) {

        let cell: Cell<ICellModel> = this._notebookState.notebook.widgets[index];

        if (cellState.get(cell).changed === false) {
          //  The cell has not changed; hence, the notebook format cell contains just its id.

          (nbFormatNotebook.cells[index] as any) = { id: nbFormatNotebook.cells[index].id };
        }
      }

      console.log({ name: name, notebook: nbFormatNotebook, cells: metas });

      for (let index = 0; index < this._notebookState.notebook.widgets.length; index++) {

        let cell: Cell<ICellModel> = this._notebookState.notebook.widgets[index];
        let state = cellState.get(cell);
        state.changed = false;
        //  The message was handled successfully; hence, it should be set to unchanged.
      }
    }
    catch (e) {
      console.error(e);
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
        //  A cell was added; hence we update the cell state.
      }
    }, this);
  }

  updateCellState() {

    this.notebook.widgets.forEach((cell: Cell<ICellModel>) => {

      if (!this.cellState.has(cell)) {

        this.cellState.set(cell, { changed: true, output: this.cellOutput(cell) });
        //  It's a new cell; hence, the changed state is set to true.

        cell.inputArea.model.value.changed.connect(
          (sender: IObservableString, args: IObservableString.IChangedArgs) => {
            console.log('cell.inputArea.model.value.changed');
            let state = this.cellState.get(cell);
            state.changed = true;
            //  The input area changed; hence, the changed state is set to true.
          });

        if (cell.model.type == "code") {

          (cell as CodeCell).model.outputs.changed.connect(
            (sender: IOutputAreaModel, args: IOutputAreaModel.ChangedArgs
            ) => {
              if (args.type == "add") {
                let state = this.cellState.get(cell);
                let output = this.cellOutput(cell);
                if (output !== state.output) {
                  state.changed = true;
                  state.output = output;
                }
                else {
                  state.changed = false;
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

        output = output + JSON.stringify(outputs.get(index).data);
      }
      return output;
    }

    return "";
  }
}

class CellsChangedEvent {

  private _handler: EventMessageHandler;
  private _notebook: Notebook;

  constructor(
    { notebook, handler }:
      { notebook: Notebook, handler: EventMessageHandler }) {

    this._notebook = notebook;
    this._handler = handler;

    this._notebook.model.cells.changed.connect(this.event, this);
  }

  event(
    sender: IObservableUndoableList<ICellModel>,
    args: IObservableList.IChangedArgs<ICellModel>) {

    if (args.type == "remove") {
      this._handler.message("remove_cell", [{ id: args.oldValues[0].id, index: args.oldIndex }]);
    }
    else if (args.type == "add") {
      this._handler.message("add_cell", [{ id: args.newValues[0].id, index: args.newIndex }]);
    }
    else {
      console.log(`Unrecognized cellsChanged event: ${args.type}`)
    }
  }
}

class SaveNotebookEvent {

  private _handler: EventMessageHandler;
  private _notebookPanel: NotebookPanel;

  constructor(
    { notebookPanel, handler }:
      { notebookPanel: NotebookPanel, handler: EventMessageHandler }) {

    this._notebookPanel = notebookPanel;
    this._handler = handler;

    this._notebookPanel.context.saveState.connect(this.event, this);
  }

  event(
    context: DocumentRegistry.IContext<INotebookModel>,
    saveState: DocumentRegistry.SaveState
  ): void {

    let cell: Cell<ICellModel>;
    let cellIds: Array<ICellMeta>;
    let index: number;

    if (saveState == "completed") {

      cellIds = [];

      for (index = 0; index < this._notebookPanel.content.widgets.length; index++) {

        cell = this._notebookPanel.content.widgets[index];

        if (this._notebookPanel.content.isSelectedOrActive(cell)) {

          cellIds.push({ id: cell.model.id, index });
        }
      }

      this._handler.message("save_notebook", cellIds);
    }
  }
}

class CellExecutedEvent {

  private _handler: EventMessageHandler;
  private _notebook: Notebook;

  constructor(
    { notebook, handler }:
      { notebook: Notebook, handler: EventMessageHandler }) {

    this._notebook = notebook;
    this._handler = handler;

    NotebookActions.executed.connect(this.event, this);
  }

  event(_: any, args: { notebook: Notebook; cell: Cell<ICellModel> }): void {

    if (args.notebook.model === this._notebook.model) {

      this._handler.message("execute_cell", [
        {
          id: args.cell.model.id,
          index: this._notebook.widgets.findIndex((value: Cell<ICellModel>) => value == args.cell)
        }
      ]);
    }
  }
}


// class ScrollEvent {

//   private _handler: EventMessageHandler;
//   private _notebook: Notebook;
//   private _timeout: number;

//   constructor(
//     { notebook, handler }:
//       { notebook: Notebook, handler: EventMessageHandler }) {

//     this._notebook = notebook;
//     this._handler = handler;

//     this._notebook.node.addEventListener("scroll", this.event.bind(this), false);
//   }

//   event(e: Event): void {

//     e.stopPropagation();

//     clearTimeout(this._timeout);

//     this._timeout = setTimeout(() => {

//       let cellIds: Array<ICellMeta> = [];
//       let cell: Cell<ICellModel>;
//       let index: number;
//       let id: string;

//       for (index = 0; index < this._notebook.widgets.length; index++) {

//         cell = this.notebookPanel.content.widgets[index];

//         let cellTop = cell.node.offsetTop;
//         let cellBottom = cell.node.offsetTop + cell.node.offsetHeight;
//         let viewTop = this.notebookNode.scrollTop;
//         let viewBottom = this.notebookNode.scrollTop + this.notebookNode.clientHeight;

//         if (cellTop > viewBottom || cellBottom < viewTop) {
//           continue;
//         }

//         id = cell.model.id;

//         cellIds.push({ id, index });
//       }

//       this.event("scroll", cellIds);

//     }, 1000);

//   }
// }


/**
 * Initialization data for the etc-jupyterlab-telemetry extension.
 */
const extension: JupyterFrontEndPlugin<object> = {
  id: "etc-jupyterlab-telemetry:plugin",
  autoStart: true,
  requires: [
    INotebookTracker,
    IDocumentManager,
    JupyterFrontEnd.IPaths,
    JupyterLab.IInfo
  ],
  activate: async (
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    documentManager: IDocumentManager,
    info: JupyterLab.IInfo
  ) => {
    console.log("JupyterLab extension etc-jupyterlab-telemetry is activated!");

    let handler: AWSAPIGatewayHandler;

    handler = new AWSAPIGatewayHandler({
      url: "https://293p82kx3j.execute-api.us-east-1.amazonaws.com/adpatter-api-aws-edtech-labs-si-umich-edu",
      bucket: "adpatter-s3-aws-edtech-labs-si-umich-edu",
      path: "test"
    });

    let resource: string;
    let id: string = null;
    let config: object = null;

    try {
      resource = "id";
      id = await requestAPI<any>(resource);
      console.log(`id: ${id}`);
    } catch (reason) {

      console.error(`Error on GET /etc-jupyterlab-telemetry/${resource}.\n${reason}`);
    }

    try {
      resource = "config";
      config = await requestAPI<object>(resource);
      console.log(`paths: ${JSON.stringify(config)}`);
    } catch (reason) {

      console.error(`Error on GET /etc-jupyterlab-telemetry/${resource}.\n${reason}`);
    }


    notebookTracker.widgetAdded.connect(async (sender: INotebookTracker, notebookPanel: NotebookPanel) => {

      await notebookPanel.revealed;
      await notebookPanel.sessionContext.ready;

      let notebookState = new NotebookState({ notebook: notebookPanel.content });
      let eventMessageHandler = new EventMessageHandler({ notebookState: notebookState });
      eventMessageHandler.message(
        "open_notebook",
        notebookPanel.content.widgets.map((cell: Cell<ICellModel>, index: number) =>
          ({ id: cell.model.id, index: index })
        ));

      new CellsChangedEvent({ notebook: notebookPanel.content, handler: eventMessageHandler });
      new SaveNotebookEvent({ notebookPanel: notebookPanel, handler: eventMessageHandler });
      new CellExecutedEvent({ notebook: notebookPanel.content, handler: eventMessageHandler });

    });

    return {};
  }
};

export default extension;