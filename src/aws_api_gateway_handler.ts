import { IHandler } from './types';

interface IAWSAPIGatewayHandlerOptions {
    url: string;
    bucket: string;
    path: string;
}

export class AWSAPIGatewayHandler implements IHandler {

    private _url: string;
    private _bucket: string;
    private _path: string;

    constructor({ url, bucket, path }: IAWSAPIGatewayHandlerOptions) {
        this._url = url;
        this._bucket = bucket;
        this._path = path;

        this.handle = this.handle.bind(this);
    }

    async handle(message: any) {

        let response = await fetch([this._url, this._bucket, this._path].join("/"), {
            method: "POST",
            mode: "cors",
            cache: "no-cache",
            headers: {
                "Content-Type": "application/json"
            },
            redirect: "follow",
            referrerPolicy: "no-referrer",
            body: JSON.stringify({ data: message })
        });

        if (response.status !== 200) {

            throw new Error(JSON.stringify({
                "response.status": response.status,
                "response.statusText": response.statusText,
                "response.text()": await response.text()
            }));
        }

        return response;
    }
}
