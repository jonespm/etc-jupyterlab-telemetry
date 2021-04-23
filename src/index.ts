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

import { requestAPI } from './handler';

interface IEventMessageOptions {
  eventName: string;
  notebookModel: INotebookModel;
  cellModels: Array<ICellModel>;
  user: string;
  debug?: any;
}

class EventMessage {

  public eventName: string;
  public notebookModel: INotebookModel;
  public cellModels: Array<ICellModel>;
  public timestamp: number;
  public user: string | null;
  public debug: any;

  constructor({
    eventName,
    notebookModel,
    cellModels,
    user,
    debug
  }: IEventMessageOptions) {

    this.eventName = eventName;
    this.notebookModel = notebookModel;
    this.cellModels = cellModels;
    this.timestamp = Date.now();
    this.user = user;
    this.debug = debug;
  }
}

interface INotebookPanelWrapperOptions {
  notebookPanel: NotebookPanel;
  id: string | null;
}

class NotebookPanelWrapper {

  private notebookPanel: NotebookPanel;
  private cells: IObservableUndoableList<ICellModel>;
  private user: string | null;
  private scrollTimeoutID: number;

  constructor({ notebookPanel, id = null }: INotebookPanelWrapperOptions) {

    this.user = id;

    this.notebookPanel = notebookPanel;

    this.cells = notebookPanel.model.cells;

    notebookPanel.content.node.addEventListener("scroll", this.scroll.bind(this), true);
    this.notebookPanel.content.model.cells.changed.connect(this.cellsChanged, this);
    this.notebookPanel.context.saveState.connect(this.saveState, this);
    NotebookActions.executed.connect(this.executed, this);

    this.notebookPanel.disposed.connect(this.dispose, this);

    each(this.cells, (cell: ICellModel, index: number) => {

      if (!cell.metadata.get("etc_hash")) {
        this.hashCell(cell).then(
          (r) => cell.metadata.set("etc_hash", r)
        ).catch(j => { console.error(j) });
      }
    });
  }

  private dispose() {

    NotebookActions.executed.disconnect(this.executed, this);
    delete this.cells;
    console.log(`${this.notebookPanel.context.path} disposed.`)
    delete this.notebookPanel;
  }

  async hashCell(cell: ICellModel): Promise<string> {

    let outputs = "";
    if (cell.type === "code") {
      outputs = JSON.stringify((cell as CodeCellModel).outputs.toJSON());
    }

    let input = cell.value.text;

    let uInt8Array = (new TextEncoder()).encode(input + outputs);

    let arrayBuffer = await crypto.subtle.digest("SHA-256", uInt8Array);

    return Array.from(new Uint8Array(arrayBuffer)).map(cur => cur.toString(16).padStart(2, "0")).join("");
  }

  private async logMessage(eventMessage: EventMessage) {

    try {

      let data = JSON.stringify({ data: eventMessage });

      console.log("\n\n")

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

  /* Event Handlers */

  scroll() {

    let notebook = this.notebookPanel.content.node;

    clearTimeout(this.scrollTimeoutID);

    this.scrollTimeoutID = setTimeout(() => {

      let cells: Array<ICellModel> = [];

      for (let cell of this.notebookPanel.content.widgets) {

        let cellTop = cell.node.offsetTop;
        let cellBottom = cell.node.offsetTop + cell.node.offsetHeight;
        let viewTop = notebook.scrollTop;
        let viewBottom = notebook.scrollTop + notebook.clientHeight;

        if (cellTop > viewBottom || cellBottom < viewTop) {
          continue;
        }

        cells.push(cell.model)
      };

      let eventMessage = new EventMessage({
        eventName: "Scroll finished.",
        notebookModel: this.notebookPanel.model,
        cellModels: cells,
        user: this.user
      });

      this.logMessage(eventMessage);

    }, 1000);
  }

  executed(_: any, arg: { notebook: Notebook; cell: Cell<ICellModel>; }) {

    if (arg.notebook.model === this.notebookPanel.model) {

      let cell = arg.cell;

      let eventMessage = new EventMessage({
        eventName: "Execution finished.",
        notebookModel: this.notebookPanel.model,
        cellModels: [cell.model],
        user: this.user
      });

      this.logMessage(eventMessage);
    }
  }

  saveState(context: DocumentRegistry.IContext<INotebookModel>, saveState: DocumentRegistry.SaveState) {

    if (saveState == "started") {

      each(this.cells, (cell: ICellModel, index: number) => {

        this.hashCell(cell).then((r) => cell.metadata.set('etc_hash', r)).catch(j => { console.error(j) });
      });

    }

    if (saveState == "completed") {

      let eventMessage = new EventMessage({
        eventName: "Save a notebook.",
        notebookModel: this.notebookPanel.model,
        cellModels: this.notebookPanel.content.widgets.filter((cell: Cell<ICellModel>) => this.notebookPanel.content.isSelectedOrActive(cell)).map((value: Cell<ICellModel>) => value.model),
        user: this.user
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
          notebookModel: this.notebookPanel.model,
          cellModels: changed.oldValues,
          user: this.user
        });
        break;
      case "add":
        eventMessage = new EventMessage({
          eventName: "Create a cell.",
          notebookModel: this.notebookPanel.model,
          cellModels: changed.newValues,
          user: this.user
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
  activate: async (
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    documentManager: IDocumentManager
  ) => {
    console.log("JupyterLab extension etc-jupyterlab-telemetry is activated!: 1");

    //
    let resource: string;
    let data: string;
    let id: string;

    try {
      resource = "environ";
      data = await requestAPI<any>(resource);
      console.log(`ENVIRONMENT VARIABLES: ${JSON.stringify(data)}`);

      // resource = "id";
      // id = await requestAPI<any>(resource);
      // console.log(`WORKSPACE_ID: ${JSON.stringify(id)}`);

    } catch (reason) {

      console.error(`Error on GET /etc-jupyterlab-telemetry/${resource}.\n${reason}`);
    }
    //  Print all environment variables to console and get the Coursera user id.

    notebookTracker.widgetAdded.connect(async (tracker: INotebookTracker, notebookPanel: NotebookPanel) => {

      await notebookPanel.revealed;
      await notebookPanel.sessionContext.ready

      new NotebookPanelWrapper({ notebookPanel, id });
    });

    return {};
  }
};

export default extension;