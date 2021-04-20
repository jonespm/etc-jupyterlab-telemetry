(self["webpackChunketc_jupyterlab_telemetry"] = self["webpackChunketc_jupyterlab_telemetry"] || []).push([["lib_index_js"],{

/***/ "./lib/index.js":
/*!**********************!*\
  !*** ./lib/index.js ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _jupyterlab_docmanager__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @jupyterlab/docmanager */ "webpack/sharing/consume/default/@jupyterlab/docmanager");
/* harmony import */ var _jupyterlab_docmanager__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_docmanager__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _lumino_algorithm__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @lumino/algorithm */ "webpack/sharing/consume/default/@lumino/algorithm");
/* harmony import */ var _lumino_algorithm__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_lumino_algorithm__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @jupyterlab/notebook */ "webpack/sharing/consume/default/@jupyterlab/notebook");
/* harmony import */ var _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_2__);




class EventMessage {
    constructor({ eventName, notebookModel, cellModels, notebookMeta, timestamp, user, debug }) {
        this.eventName = eventName;
        this.notebookModel = notebookModel;
        this.cellModels = cellModels;
        this.notebookMeta = notebookMeta;
        this.timestamp = timestamp;
        this.user = user;
        this.debug = debug;
    }
}
class NotebookPanelWrapper {
    constructor({ notebookPanel }) {
        this._notebookPanel = notebookPanel;
        notebookPanel.content.node.addEventListener("scroll", this.scroll.bind(this));
        this._cells = notebookPanel.model.cells;
        this._notebookPanel.content.model.cells.changed.connect(this.cellsChanged, this);
        this._notebookPanel.context.saveState.connect(this.saveState, this);
        this._notebookPanel.sessionContext.sessionChanged.connect(this.sessionChanged, this);
        _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_2__.NotebookActions.executed.connect(this.executed, this);
        this._notebookPanel.disposed.connect(this._dispose, this);
        (0,_lumino_algorithm__WEBPACK_IMPORTED_MODULE_1__.each)(this._cells, (cell, index) => {
            if (!cell.metadata.get("etc_hash")) {
                this.hashCell(cell).then((r) => cell.metadata.set('etc_hash', r)).catch(j => { console.error(j); });
            }
        });
    }
    _dispose() {
        _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_2__.NotebookActions.executed.disconnect(this.executed, this);
        delete this._cells;
        console.log(`${this._notebookPanel.context.path} disposed.`);
        delete this._notebookPanel;
    }
    scroll(e) {
        clearTimeout(this._scrollTimeoutID);
        this._scrollTimeoutID = setTimeout(() => {
            let cells = [];
            this._notebookPanel.content.widgets.forEach((cell) => {
                if ((cell.node.offsetTop + cell.node.offsetHeight) > e.target.scrollTop) {
                    cells.push(cell.model);
                }
            });
            let eventMessage = new EventMessage({
                eventName: "Scroll finished.",
                notebookModel: this._notebookPanel.model,
                cellModels: cells,
                notebookMeta: this._notebookPanel.model.metadata,
                timestamp: Date.now(),
                user: this._user
            });
            this.logMessage(eventMessage);
        }, 1000);
    }
    async logMessage(eventMessage) {
        try {
            let data = JSON.stringify({ data: eventMessage });
            console.log(eventMessage.eventName, data);
            let response = await fetch("https://293p82kx3j.execute-api.us-east-1.amazonaws.com/adpatter-api-aws-edtech-labs-si-umich-edu/adpatter-s3-aws-edtech-labs-si-umich-edu/test", {
                method: "POST",
                mode: "cors",
                cache: "no-cache",
                headers: {
                    "Content-Type": "application/json"
                    // "Content-Type": "application/x-www-form-urlencoded",
                },
                redirect: "follow",
                referrerPolicy: "no-referrer",
                body: data // body data type must match "Content-Type" header
            });
            if (!response.ok) {
                let headers = {};
                try {
                    response.headers.forEach((value, key) => {
                        headers[key] = value;
                    });
                }
                catch (_a) {
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
    getCell(cellId) {
        for (let i = 0; i < this._notebookPanel.model.cells.length; i = i + 1) {
            let cell = this._notebookPanel.model.cells.get(i);
            if (cell.id == cellId) {
                return cell;
            }
        }
    }
    sessionChanged(sessionContext, changedArgs) {
        var _a, _b;
        (_b = (_a = changedArgs === null || changedArgs === void 0 ? void 0 : changedArgs.newValue) === null || _a === void 0 ? void 0 : _a.kernel) === null || _b === void 0 ? void 0 : _b.anyMessage.connect((kernelConnection, anyMessageArgs) => {
            var _a, _b;
            if (!this._user && anyMessageArgs.direction == "recv" && ((_b = (_a = anyMessageArgs === null || anyMessageArgs === void 0 ? void 0 : anyMessageArgs.msg) === null || _a === void 0 ? void 0 : _a.header) === null || _b === void 0 ? void 0 : _b.username) !== "") {
                this._user = anyMessageArgs.msg.header.username;
            }
        });
    }
    executed(_, arg) {
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
    async hashCell(cell) {
        let outputs = "";
        if (cell.type === "code") {
            outputs = JSON.stringify(cell.outputs.toJSON());
        }
        let input = cell.value.text;
        let uInt8Array = (new TextEncoder()).encode(input + outputs);
        let arrayBuffer = await crypto.subtle.digest("SHA-256", uInt8Array);
        return Array.from(new Uint8Array(arrayBuffer)).map(cur => cur.toString(16).padStart(2, "0")).join("");
    }
    saveState(context, saveState) {
        if (saveState == "started") {
            (0,_lumino_algorithm__WEBPACK_IMPORTED_MODULE_1__.each)(this._cells, (cell, index) => {
                this.hashCell(cell).then((r) => cell.metadata.set('etc_hash', r)).catch(j => { console.error(j); });
            });
        }
        if (saveState == "completed") {
            let eventMessage = new EventMessage({
                eventName: "Save a notebook.",
                notebookModel: this._notebookPanel.model,
                cellModels: this._notebookPanel.content.widgets.filter((cell) => this._notebookPanel.content.isSelectedOrActive(cell)).map((value) => value.model),
                notebookMeta: this._notebookPanel.model.metadata,
                timestamp: Date.now(),
                user: this._user
            });
            this.logMessage(eventMessage);
        }
    }
    cellsChanged(cells, changed) {
        let eventMessage;
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
const extension = {
    id: "etc-jupyterlab-telemetry:plugin",
    autoStart: true,
    requires: [
        _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_2__.INotebookTracker,
        _jupyterlab_docmanager__WEBPACK_IMPORTED_MODULE_0__.IDocumentManager
    ],
    activate: (app, notebookTracker, documentManager) => {
        console.log("JupyterLab extension etc-jupyterlab-telemetry is activated!");
        notebookTracker.widgetAdded.connect(async (tracker, notebookPanel) => {
            await notebookPanel.revealed;
            await notebookPanel.sessionContext.ready;
            new NotebookPanelWrapper({ notebookPanel });
        });
        return {};
    }
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (extension);


/***/ })

}]);
//# sourceMappingURL=lib_index_js.ca9b0cadb3109f270858.js.map