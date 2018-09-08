import {computed} from "mobx";
import {join} from "path-browserify";
import {SchemeNodeRoot} from "./SchemeNodeRoot";
import {Directory} from "./Directory";
import {File} from "./File";

export interface ISchemeNodeProps {
  // public
  scheme?: Array<[string, File | Directory]>;
  // internal
  path?: string;
  parentNode?: SchemeNode;
}

export class SchemeNode {
  props: ISchemeNodeProps;
  constructor(props: ISchemeNodeProps) {
    this.props = props;
  }
  @computed
  get absolutePath(): string {
    if (this.props.parentNode) {
      return join(this.props.parentNode.absolutePath, this.props.path || "");
    }
    return join("/", this.props.path || "");
  }
  @computed
  get rootNode(): SchemeNodeRoot {
    if (this.props.parentNode) return this.props.parentNode.rootNode;
    return (this as any) as SchemeNodeRoot;
  }
}
