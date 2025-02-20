import { Response } from "botbuilder";

export class ResponseWrapper implements Response {
  socket: any;
  originalResponse?: any;
  headers?: any;
  body?: any;

  constructor(functionResponse?: { [key: string]: any }) {
    this.socket = undefined;
    this.originalResponse = functionResponse;
  }

  //@ts-ignore
  end(...args: any[]) {
    // do nothing since res.end() is deprecated in Azure Functions.
  }

  header(name: string, value: any) {
    this.headers[name] = value;
  }

  send(body: any) {
    // record the body to be returned later.
    this.body = body;
    this.originalResponse.body = body;
  }

  status(status: number) {
    // call Azure Functions' res.status().
    return this.originalResponse?.status(status);
  }
}
