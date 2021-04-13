import {
  ConnectionLost,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from "@jupyterlab/application";

// Common Extension Point
import {
  IConnectionLost,
  ILabStatus,
  ILabShell,
  ILayoutRestorer,
  IMimeDocumentTracker,
  IRouter
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

//

import { ISettingRegistry } from "@jupyterlab/settingregistry";
import { each } from "@lumino/algorithm";
import { CommandRegistry } from "@lumino/commands";
import { ISignal, Signal, Slot } from "@lumino/signaling";
import { PartialJSONValue } from '@lumino/coreutils';
import { INotebookTracker, NotebookPanel, INotebookModel, Notebook, NotebookModel } from "@jupyterlab/notebook";
import { NotebookActions } from '@jupyterlab/notebook';
import { Cell, CodeCell, CodeCellModel, ICellModel, ICodeCellModel } from "@jupyterlab/cells";
import { Session, Kernel } from '@jupyterlab/services';
import { JSONExt, JSONObject } from "@lumino/coreutils";

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

interface IEventMessageOptions {
  eventName: string;
  notebookModel: INotebookModel;
  cellModels: Array<ICellModel>;
  notebookMeta: IObservableJSON;
  timestamp: number;
  user: string;
  debug?: any;
}

class EventMessage {

  public eventName: string;
  public notebookModel: INotebookModel;
  public cellModels: Array<ICellModel>;
  public notebookMeta: IObservableJSON;
  public timestamp: number;
  public user: string | null;
  public debug: any;

  constructor({
    eventName,
    notebookModel,
    cellModels,
    notebookMeta,
    timestamp,
    user,
    debug
  }: IEventMessageOptions) {

    this.eventName = eventName;
    this.notebookModel = notebookModel;
    this.cellModels = cellModels;
    this.notebookMeta = notebookMeta;
    this.timestamp = timestamp;
    this.user = user;
    this.debug = debug;
  }
}

interface IStateValue {
  executeRequest?: Kernel.IAnyMessageArgs;
  executeInput?: Kernel.IAnyMessageArgs;
  executeReply?: Kernel.IAnyMessageArgs;
}

interface INotebookPanelWrapperOptions {
  notebookPanel: NotebookPanel;
}

class NotebookPanelWrapper {

  private _state: Map<string, IStateValue>;
  private _notebookPanel: NotebookPanel;
  private _cells: IObservableUndoableList<ICellModel>;
  private _user: string;

  constructor({ notebookPanel }: INotebookPanelWrapperOptions) {

    this._notebookPanel = notebookPanel;

    this._cells = notebookPanel.model.cells;

    this._notebookPanel.content.model.cells.changed.connect(this.cellsChanged, this);
    this._notebookPanel.context.saveState.connect(this.saveState, this);
    this._notebookPanel.sessionContext.sessionChanged.connect(this.sessionChanged, this);
    NotebookActions.executed.connect(this.executed, this);

    this._notebookPanel.disposed.connect(this._dispose, this);

    each(this._cells, (cell: ICellModel, index: number) => {

      if (!cell.metadata.get("etc_hash")) {
        this.hashCell(cell).then(
          (r) => cell.metadata.set('etc_hash', r)
        ).catch(j => { console.error(j) });
      }
    });
  }

  private _dispose() {

    NotebookActions.executed.disconnect(this.executed, this);
    delete this._cells;
    console.log(`${this._notebookPanel.context.path} disposed.`)
    delete this._notebookPanel;
  }

  async logMessage(eventMessage: EventMessage) {

    try {

      let data = JSON.stringify({ data: eventMessage });

      console.log(eventMessage.eventName, data);

      let response = await fetch("https://293p82kx3j.execute-api.us-east-1.amazonaws.com/adpatter-api-aws-edtech-labs-si-umich-edu/adpatter-s3-aws-edtech-labs-si-umich-edu/test", {
        method: "POST", // *GET, POST, PUT, DELETE, etc.
        mode: "cors", // no-cors, *cors, same-origin
        cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
        headers: {
          "Content-Type": "application/json"
          // "Content-Type": "application/x-www-form-urlencoded",
        },
        redirect: "follow", // manual, *follow, error
        referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
        body: data // body data type must match "Content-Type" header
      });

      if (!response.ok) {

        let headers: { [key: string]: string } = {};

        try {
          response.headers.forEach((value: string, key: string) => {
            headers[key] = value;
          });
        }
        catch {
          // forEach is iffy in the API. 
        }

        throw new Error(JSON.stringify({
          "response.status": response.status,
          "response.statusText": response.statusText,
          "response.text()": await response.text(),
          "response.headers": headers
        }));
      }
    }
    catch (e) {
      console.error(e);
    }
  }

  getCell(cellId: string): ICellModel {

    for (let i = 0; i < this._notebookPanel.model.cells.length; i = i + 1) {
      let cell = this._notebookPanel.model.cells.get(i);
      if (cell.id == cellId) {
        return cell;
      }
    }
  }

  sessionChanged(sessionContext: ISessionContext, changedArgs: IChangedArgs<Session.ISessionConnection, Session.ISessionConnection, "session">) {

    changedArgs?.newValue?.kernel?.anyMessage.connect((kernelConnection: Kernel.IKernelConnection, anyMessageArgs: Kernel.IAnyMessageArgs) => {

      if (!this._user && anyMessageArgs.direction == "recv" && anyMessageArgs?.msg?.header?.username !== "") {

        this._user = anyMessageArgs.msg.header.username;
      }
    });
  }

  executed(_: any, arg: { notebook: Notebook; cell: Cell<ICellModel>; }) {

    if (arg.notebook.model === this._notebookPanel.model) {

      let cell = arg.cell;

      let eventMessage = new EventMessage({
        eventName: "Execution finished.",
        notebookModel: this._notebookPanel.model,
        cellModels: [cell.model],
        notebookMeta: this._notebookPanel.model.metadata,
        timestamp: Date.now(),
        user: this._user
      });

      this.logMessage(eventMessage);
    }
  }

  async hashCell(cell: ICellModel): Promise<string> {

    let uInt8Array = (new TextEncoder()).encode(JSON.stringify(cell.toJSON()));

    let arrayBuffer = await crypto.subtle.digest("SHA-256", uInt8Array);

    return Array.from(new Uint8Array(arrayBuffer)).map(cur => cur.toString(16).padStart(2, "0")).join("");
  }

  saveState(context: DocumentRegistry.IContext<INotebookModel>, saveState: DocumentRegistry.SaveState) {

    if (saveState == "started") {

      each(this._cells, (cell: ICellModel, index: number) => {

        this.hashCell(cell).then((r) => cell.metadata.set('etc_hash', r)).catch(j => { console.error(j) });
      });

    }

    if (saveState == "completed") {

      let eventMessage = new EventMessage({
        eventName: "Save a notebook.",
        notebookModel: this._notebookPanel.model,
        cellModels: this._notebookPanel.content.widgets.filter((cell: Cell<ICellModel>) => this._notebookPanel.content.isSelectedOrActive(cell)).map((value: Cell<ICellModel>) => value.model),
        notebookMeta: this._notebookPanel.model.metadata,
        timestamp: Date.now(),
        user: this._user
      });

      this.logMessage(eventMessage);
    }
  }

  cellsChanged(
    cells: IObservableUndoableList<ICellModel>,
    changed: IObservableList.IChangedArgs<ICellModel>) {

    let eventMessage: EventMessage;

    switch (changed.type) {
      case "remove":
        eventMessage = new EventMessage({
          eventName: "Delete a cell.",
          notebookModel: this._notebookPanel.model,
          cellModels: changed.oldValues,
          notebookMeta: this._notebookPanel.model.metadata,
          timestamp: Date.now(),
          user: this._user
        });
        break;
      case "add":
        eventMessage = new EventMessage({
          eventName: "Create a cell.",
          notebookModel: this._notebookPanel.model,
          cellModels: changed.newValues,
          notebookMeta: this._notebookPanel.model.metadata,
          timestamp: Date.now(),
          user: this._user
        });
        break;
      default:
        break;
    }

    if (eventMessage) {
      this.logMessage(eventMessage);
    }
    else {
      console.error("Undefined changed.type: ", changed.type);
    }
  }
}

/**
 * Initialization data for the etc-jupyterlab-telemetry extension.
 */
const extension: JupyterFrontEndPlugin<object> = {
  id: "etc-jupyterlab-telemetry:plugin",
  autoStart: true,
  requires: [
    INotebookTracker,
    IDocumentManager
  ],
  activate: (
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    documentManager: IDocumentManager
  ) => {

    console.log("JupyterLab extension etc-jupyterlab-telemetry is activated!")

    notebookTracker.widgetAdded.connect(async (tracker: INotebookTracker, notebookPanel: NotebookPanel) => {

      await notebookPanel.revealed;

      new NotebookPanelWrapper({ notebookPanel });

    });

    return {};
  }
};

export default extension;