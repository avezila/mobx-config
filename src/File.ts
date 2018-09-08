import {observable, computed} from "mobx";
import {normalize, join, dirname} from "path-browserify";
import {load as yamlLoad} from "js-yaml";

export interface IFileProps {
  root: string;
  path: string;
}

export class File {
  @observable
  props: IFileProps;
  disposers: (() => void)[] = [];

  @observable
  source = "";

  @computed
  get path() {
    return normalize(this.props.path);
  }
  @computed
  get dirname() {
    return dirname(this.path);
  }
  @computed
  get root() {
    return normalize(this.props.root);
  }
  @computed
  get absolutePath(): string {
    return join(this.props.root, this.props.path);
  }
  IsFile() {
    return true;
  }
  IsDirectory() {
    return false;
  }

  @computed
  get json(): any {
    let json = [];
    try {
      json = yamlLoad(this.source);
    } catch (e) {
      console.error(`${this.absolutePath}:\nFailed convert yaml to json\n${e.stack}`);
    }
    return json;
  }

  constructor(props: IFileProps) {
    this.props = props;
  }
  destructor() {
    this.disposers.reverse().forEach(d => d());
    this.disposers = [];
  }
}
