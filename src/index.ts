import {
  ConnectionLost,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from "@jupyterlab/application";

import { UUID } from '@lumino/coreutils';

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
import { INotebookTracker, NotebookPanel, INotebookModel, Notebook, NotebookModel, CellTypeSwitcher } from "@jupyterlab/notebook";
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

interface ICellMeta {
  index: number;
  id: any;
}

interface IEventMessage {
  eventName: string;
  notebook?: INotebookModel;
  UUID: string;
  cellIds: Array<ICellMeta>;
  user: string;
}


interface INotebookPanelWrapperOptions {
  notebookPanel: NotebookPanel;
  id: string | null;
}

class NotebookPanelWrapper {

  private notebookPanel: NotebookPanel;
  private cells: IObservableUndoableList<ICellModel>;
  private user: string | null;
  private scrollTimeoutId: number;
  private notebookNode: HTMLElement;
  private contentChanged: boolean;
  private UUID: string;

  constructor({ notebookPanel, id = null }: INotebookPanelWrapperOptions) {

    this.UUID = UUID.uuid4();
    this.contentChanged = true;

    this.user = id;
    this.notebookPanel = notebookPanel;
    this.cells = notebookPanel.model.cells;
    this.notebookNode = this.notebookPanel.content.node;

    notebookPanel.model.contentChanged.connect((notebookModel: INotebookModel, _: void) => {
      this.contentChanged = true;
    });
    this.notebookNode.addEventListener("scroll", this.scroll.bind(this), false);
    this.notebookPanel.content.model.cells.changed.connect(this.cellsChanged, this);
    this.notebookPanel.context.saveState.connect(this.saveState, this);
    NotebookActions.executed.connect(this.executed, this);
    
    this.notebookPanel.disposed.connect(this.dispose, this);

    this.firstRender();
  }

  private dispose() {

    // NotebookActions.executed.disconnect(this.executed, this);

    delete this.cells;

    console.log(`${this.notebookPanel.context.path} disposed.`);

    delete this.notebookPanel;
  }

  private async event(eventName: string, cellIds: Array<ICellMeta>) {

    try {

      let eventMessage: IEventMessage;

      if (this.contentChanged) {
        this.contentChanged = false;
        this.UUID = UUID.uuid4();

        eventMessage = {
          eventName,
          UUID: this.UUID,
          notebook: this.notebookPanel.model,
          cellIds,
          user: this.user
        }
      }
      else {
        eventMessage = {
          eventName,
          UUID: this.UUID,
          cellIds,
          user: this.user
        }
      }

      console.log("JSON.stringify(eventMessage): ", JSON.stringify(eventMessage));

      let response = await fetch("https://293p82kx3j.execute-api.us-east-1.amazonaws.com/adpatter-api-aws-edtech-labs-si-umich-edu/adpatter-s3-aws-edtech-labs-si-umich-edu/test", {
        method: "POST",
        mode: "cors",
        cache: "no-cache",
        headers: {
          "Content-Type": "application/json"
        },
        redirect: "follow",
        referrerPolicy: "no-referrer",
        body: JSON.stringify(eventMessage)
      });

      if (response.status !== 200) {

        throw new Error(JSON.stringify({
          "response.status": response.status,
          "response.statusText": response.statusText,
          "response.text()": await response.text()
        }));
      }
    }
    catch (e) {
      console.error(e);
    }
  }

  visiblecellIds() {

    let cellIds: Array<ICellMeta> = [];
    let cell: Cell<ICellModel>;
    let index: number;
    let id: string;

    for (index = 0; index < this.notebookPanel.content.widgets.length; index++) {

      cell = this.notebookPanel.content.widgets[index];
      let cellTop = cell.node.offsetTop;
      let cellBottom = cell.node.offsetTop + cell.node.offsetHeight;
      let viewTop = this.notebookNode.scrollTop;
      let viewBottom = this.notebookNode.scrollTop + this.notebookNode.clientHeight;

      if (cellTop > viewBottom || cellBottom < viewTop) {
        continue;
      }

      id = cell.model.id;

      cellIds.push({ id, index });
    }

    return cellIds;
  }
  /* Event Handlers */

  firstRender() {

    let cellIds: Array<ICellMeta>;

    cellIds = this.visiblecellIds();

    this.event("first_render", cellIds);
  }

  scroll(e: Event) {

    e.stopPropagation();

    clearTimeout(this.scrollTimeoutId);

    this.scrollTimeoutId = setTimeout(() => {

      let cellIds: Array<ICellMeta>;

      cellIds = this.visiblecellIds();

      this.event("scroll", cellIds);

    }, 1000);
  }

  executed(_: any, arg: { notebook: Notebook; cell: Cell<ICellModel>; }): void {

    if (arg.notebook.model === this.notebookPanel.model) {

      let index: number;
      let cell: Cell<ICellModel>;

      cell = arg.cell;

      for (index = 0; index < this.cells.length; index++) {
        if (cell.model === this.cells.get(index)) {
          break;
        }
      }

      this.event("execute_cell", [{ id: cell.model.id, index }]);
    }
  }

  saveState(
    context: DocumentRegistry.IContext<INotebookModel>,
    saveState: DocumentRegistry.SaveState
  ): void {

    let cell: Cell<ICellModel>;
    let cellIds: Array<ICellMeta>;
    let index: number;

    if (saveState == "completed") {

      cellIds = [];

      for (index = 0; index < this.notebookPanel.content.widgets.length; index++) {

        cell = this.notebookPanel.content.widgets[index];

        if (this.notebookPanel.content.isSelectedOrActive(cell)) {

          cellIds.push({ id: cell.model.id, index });
        }
      }

      this.event("save_notebook", cellIds);
    }
  }

  cellsChanged(
    cells: IObservableUndoableList<ICellModel>,
    changed: IObservableList.IChangedArgs<ICellModel>) {

    if (changed.type == "remove") {
      this.event("remove_cell", [{id:changed.oldValues[0].id, index:changed.oldIndex}]);
    }
    else if (changed.type == "add") {
      this.event("add_cell", [{id:changed.newValues[0].id, index:changed.newIndex}]);
    }
    else {
      console.log(`Unrecognized cellsChanged event: ${changed.type}`)
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
    console.log("JupyterLab extension etc-jupyterlab-telemetry is activated!");

    //
    let resource: string;
    let id: string;

    try {

      resource = "id";
      id = await requestAPI<any>(resource);
      console.log(`WORKSPACE_ID: ${JSON.stringify(id)}`);

    } catch (reason) {

      console.error(`Error on GET /etc-jupyterlab-telemetry/${resource}.\n${reason}`);
    }

    notebookTracker.widgetAdded.connect(async (tracker: INotebookTracker, notebookPanel: NotebookPanel) => {

      await notebookPanel.revealed;
      await notebookPanel.sessionContext.ready

      new NotebookPanelWrapper({ notebookPanel, id });
    });

    return {};
  }
};

export default extension;