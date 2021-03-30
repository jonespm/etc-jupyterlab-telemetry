import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from "@jupyterlab/application";
import { CommandRegistry } from "@lumino/commands";
import { ISignal } from "@lumino/signaling";
import { PartialJSONValue } from '@lumino/coreutils';
import { INotebookTracker, NotebookPanel, INotebookModel, Notebook } from "@jupyterlab/notebook";
import { NotebookActions } from '@jupyterlab/notebook';
import { Cell, CodeCell, CodeCellModel, ICellModel, ICodeCellModel } from "@jupyterlab/cells";
import { JSONExt, JSONObject } from "@lumino/coreutils";
import {
  IObservableJSON,
  IObservableList,
  IObservableUndoableList
} from "@jupyterlab/observables";
import { IChangedArgs } from "@jupyterlab/coreutils";
import { DocumentRegistry } from "@jupyterlab/docregistry";

import { Contents } from '@jupyterlab/services';

declare var globalApp: JupyterFrontEnd;

// import { URLExt } from "@jupyterlab/coreutils";

// import { ServerConnection } from "@jupyterlab/services";

// import { requestAPI } from "./handler";


// class SignalLibrary {

//   private _wrapper: SignalWrapper;
//   private _removeCell: ISignal<IObservableUndoableList<ICellModel>, IObservableList.IChangedArgs<ICellModel>>

//   constructor(wrapper: SignalWrapper) {
//     this._wrapper = wrapper;
//   }

//   get removeCell(): ISignal<IObservableUndoableList<ICellModel>, IObservableList.IChangedArgs<ICellModel>> {


//     return;
//   }

// }


// interface ISignalWrapperOptions {
//   signalLibrary: SignalLibrary;
//   app: JupyterFrontEnd;
//   nbTracker: INotebookTracker;
// }

// class SignalWrapper {

//   private _app: JupyterFrontEnd;
//   private _tracker: INotebookTracker;
//   private _notebooks: Array<NotebookPanel>;
//   private _cellChangedSignal: ISignal<IObservableUndoableList<ICellModel>, IObservableList.IChangedArgs<ICellModel>>;
//   private _signalLibrary: SignalLibrary;

//   constructor({ signalLibrary, app, nbTracker }: ISignalWrapperOptions) {

//     this._signalLibrary = signalLibrary;
//     this._app = app;
//     this._tracker = nbTracker;

//     this._notebooks = [];

//     nbTracker.widgetAdded.connect(async (tracker: INotebookTracker, nbPanel: NotebookPanel) => {

//       this._notebooks.push(nbPanel);
//       nbPanel.disposed.connect((nbPanel: NotebookPanel) => {
//         this._notebooks.filter((value: NotebookPanel) => value != nbPanel);
//       });
//     });
//   }

//   addCellChangedHandler() {
//     if (!this._cellChangedSignal) {

//     }
//   }
// }

interface IEventMessageOptions {
  notebook: PartialJSONValue;
  cells: Array<ICellModel>;
  notebookMeta: IObservableJSON;
  timestamp: number
}

class EventMessage {
  public notebook: PartialJSONValue;
  public cells: Array<ICellModel>;
  public notebookMeta: IObservableJSON;
  public timestamp: number;

  constructor({
    notebook,
    cells,
    notebookMeta,
    timestamp
  }: IEventMessageOptions) {

    this.notebook = notebook;
    this.cells = cells;
    this.notebookMeta = notebookMeta;
    this.timestamp = timestamp;
  }
}

/**
 * Initialization data for the etc-jupyterlab-telemetry extension.
 */
const extension: JupyterFrontEndPlugin<object> = {
  id: "etc-jupyterlab-telemetry:plugin",
  autoStart: true,
  requires: [INotebookTracker],
  activate: (app: JupyterFrontEnd, nbTracker: INotebookTracker) => {

    console.log("JupyterLab extension etc-jupyterlab-telemetry is activated!");

    nbTracker.widgetAdded.connect(async (tracker: INotebookTracker, nbPanel: NotebookPanel) => {

      await nbPanel.revealed;

      // fileChanged
      nbPanel.context.fileChanged.connect((context: DocumentRegistry.IContext<INotebookModel>, model: Contents.IModel) => {
        // console.log("fileChanged: ", {
        //   context: context,
        //   model: model
        // });

        let eventMessage = new EventMessage({
          notebook: nbPanel.model.toJSON(),
          cells: nbPanel.content.widgets.filter((cell: Cell<ICellModel>)=> nbPanel.content.isSelectedOrActive(cell)).map((value: Cell<ICellModel>)=>value.model),
          notebookMeta: nbPanel.model.metadata,
          timestamp: Date.now()
        });

        console.log("fileChanged: ", eventMessage);
        window.eventMessage = eventMessage;
      });


      // executed
      NotebookActions.executed.connect((_: any, meta: {
        notebook: Notebook;
        cell: Cell<ICellModel>;
      }) => {
        let eventMessage = new EventMessage({
          notebook: nbPanel.model.toJSON(),
          cells: [meta.cell.model],
          notebookMeta: nbPanel.model.metadata,
          timestamp: Date.now()
        });

        console.log("executed: ", eventMessage);
        window.eventMessage = eventMessage;
      });


      nbPanel.model.stateChanged.connect((nbPanel: INotebookModel, args: IChangedArgs<any, any, string>) => {
        console.log("stateChanged: ", {
          nbPanel: nbPanel,
          args: args
        });
      });

      nbPanel.content.model.contentChanged.connect((nbModel: INotebookModel)=>{
        console.log("contentChanged: ", nbModel);
      })

      // cells changed
      nbPanel.content.model.cells.changed.connect(
        (
          cells: IObservableUndoableList<ICellModel>,
          changed: IObservableList.IChangedArgs<ICellModel>
        ) => {

          let eventMessage: EventMessage;

          switch (changed.type) {
            case "remove":
              eventMessage = new EventMessage({
                notebook: nbPanel.model.toJSON(),
                cells: changed.oldValues,
                notebookMeta: nbPanel.model.metadata,
                timestamp: Date.now()
              });
              break;
            case "add":
              eventMessage = new EventMessage({
                notebook: nbPanel.model.toJSON(),
                cells: changed.newValues,
                notebookMeta: nbPanel.model.metadata,
                timestamp: Date.now()
              });
              break;
            default:
              break;
          }

          if (eventMessage) {
            window.eventMessage = eventMessage;
            console.log(changed.type + ": ", eventMessage);
          }
          else {
            console.log("Undefined changed.type: ", changed.type);
          }

        });
    });

    return {};
  }
};

export default extension;