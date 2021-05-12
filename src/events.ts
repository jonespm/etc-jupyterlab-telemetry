
import {
    NotebookPanel,
    INotebookModel,
    Notebook,
    NotebookActions
} from "@jupyterlab/notebook";

import {
    Cell,
    ICellModel
} from "@jupyterlab/cells";

import {
    IObservableList,
    IObservableUndoableList
} from "@jupyterlab/observables";


import {
    DocumentRegistry
} from "@jupyterlab/docregistry";


import {
    ICellMeta
} from './types';

import { EventMessageHandler } from "./index"

export class SaveNotebookEvent {

    private _handler: EventMessageHandler;
    private _notebookPanel: NotebookPanel;

    public static schema = "http://mentoracademy.org/events/save-notebook-event.json";

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

export class CellExecutedEvent {

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

export class ScrollEvent {

    private _handler: EventMessageHandler;
    private _notebook: Notebook;
    private _timeout: number;

    constructor(
        { notebook, handler }:
            { notebook: Notebook, handler: EventMessageHandler }) {

        this._notebook = notebook;
        this._handler = handler;
        // this._schema = 'org.mentoracademy.scroll_event'

        this._notebook.node.addEventListener("scroll", this.event.bind(this), false);
    }

    event(e: Event): void {

        e.stopPropagation();

        clearTimeout(this._timeout);

        this._timeout = setTimeout(() => {

            let cellIds: Array<ICellMeta> = [];
            let cell: Cell<ICellModel>;
            let index: number;
            let id: string;

            for (index = 0; index < this._notebook.widgets.length; index++) {

                cell = this._notebook.widgets[index];

                let cellTop = cell.node.offsetTop;
                let cellBottom = cell.node.offsetTop + cell.node.offsetHeight;
                let viewTop = this._notebook.node.scrollTop;
                let viewBottom = this._notebook.node.scrollTop + this._notebook.node.clientHeight;

                if (cellTop > viewBottom || cellBottom < viewTop) {
                    continue;
                }

                id = cell.model.id;

                cellIds.push({ id, index });
            }

            this._handler.message("scroll", cellIds);

        }, 1000);

    }
}

export class ActiveCellChangedEvent {

    private _handler: EventMessageHandler;
    private _notebook: Notebook;

    constructor(
        { notebook, handler }:
            { notebook: Notebook, handler: EventMessageHandler }) {

        this._notebook = notebook;
        this._handler = handler;

        this._notebook.activeCellChanged.connect(this.event, this);
    }

    event(send: Notebook, args: Cell<ICellModel>): void {

        this._handler.message("active_cell_changed", [
            {
                id: args.model.id,
                index: this._notebook.widgets.findIndex((value: Cell<ICellModel>) => value == args)
            }
        ]);
    }
}

export class OpenNotebookEvent {

    private _handler: EventMessageHandler;
    private _notebook: Notebook;

    constructor(
        { notebook, handler }:
            { notebook: Notebook, handler: EventMessageHandler }) {

        this._notebook = notebook;
        this._handler = handler;

        setTimeout(this.event.bind(this));
    }

    event(): void {
        this._handler.message(
            "open_notebook",
            this._notebook.widgets.map((cell: Cell<ICellModel>, index: number) =>
                ({ id: cell.model.id, index: index })
            ));
    }
}

export class CellsChangedEvent {

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