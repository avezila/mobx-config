import {ErrCode} from "./ErrCode";
import {dump} from "js-yaml";

export interface IErrJSON {
  message: string;
  stack: string;
  code: ErrCode[];
}

export interface IErr {
  HasCode(code: ErrCode): boolean;
  Wrap(message: string, codes?: ErrCode[], data?: any): IErr;
  JSON(): IErrJSON;
}

export interface IErrProps {
  message: string; // Human readable message in national language
  codes?: ErrCode[]; // All codes this error accept
}

export class Err implements IErr {
  private props: IErrProps;
  private wrapped: Err[] = [];
  private stack: string;
  constructor(message: string, codes?: ErrCode[], data?: any) {
    if (data !== void 0) {
      message = `${message}\n${"-".repeat(80)}\n${dump(data, {
        flowLevel: 2,
        noRefs: true,
        noCompatMode: true,
        skipInvalid: true,
        lineWidth: 78,
      })
        .split("\n")
        .map(s => "  " + s)
        .join("\n")}${"-".repeat(80)}\n`;
    }
    this.props = {message, codes};
    this.stack = new Error()
      .stack!.split("\n")
      .slice(2)
      .join("\n");
  }
  Wrap(message: string, codes?: ErrCode[]): Err {
    let err = new Err(message, codes);
    err.wrapped = [this, ...this.wrapped];
    return err;
  }
  HasCode(code: ErrCode): boolean {
    let errs = [this, ...this.wrapped];
    for (let err of errs) {
      if (!err.props.codes) continue;
      if (err.props.codes.includes(code)) return true;
    }
    return false;
  }
  RootError() {
    return this.wrapped[this.wrapped.length - 1] || this;
  }
  JSON(): IErrJSON {
    return {
      stack: this.RootError().stack,
      message: [
        [this, ...this.wrapped.slice(0, this.wrapped.length - 1)].map(e => "  " + e.props.message),
        this.RootError().props.message,
      ]
        .reverse()
        .join("\n"),
      code: Array.from(
        new Set(
          [this, ...this.wrapped]
            .map(err => err.props.codes || [])
            .reduce((l, r) => [...l, ...r], [])
        )
      ),
    };
  }
}
