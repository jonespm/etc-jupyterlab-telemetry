import { INotebookModel } from "@jupyterlab/notebook";


export interface IEventMessage {
    eventName: string;
    notebook?: INotebookModel;
    notebookUUID: string;
    cellIds: Array<ICellMeta>;
    user: string;
}

export interface ICellMeta {
    index: number;
    id: any;
}

export interface IHandler {
    handle(msg: any): Promise<any>;
}