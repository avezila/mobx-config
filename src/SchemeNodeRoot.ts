import {SchemeNode, ISchemeNodeProps} from "./SchemeNode";
import {observable, action} from "mobx";
import {File} from "./File";
import {Directory} from "./Directory";

interface ISchemeNodeRootProps extends ISchemeNodeProps {}

export class SchemeNodeRoot extends SchemeNode {
  @observable
  files: [string, File | Directory][] = []; // path in config => file or dir with sources

  @observable
  nodeByPath = new Map<string, SchemeNode>();

  constructor(props: ISchemeNodeRootProps) {
    super(props);
    this.nodeByPath.set("/", this);
  }

  @action
  AddScheme(config: File | Directory, path = "/") {
    this.files.push([path, config]);
  }
}
