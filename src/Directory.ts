import {observable, computed, action} from "mobx";
import {normalize, join} from "path-browserify";
import {File} from "./File";

export interface IDirectoryProps {
  root: string;
  path: string;
}

export class Directory {
  @observable
  props: IDirectoryProps;
  disposers: (() => void)[] = [];

  @observable
  files = new Map<string, File>(); // clean names without ./
  @observable
  directories = new Map<string, Directory>(); // clean names without ./
  @computed
  get sortedDirectories() {
    return Array.from(this.directories.keys())
      .sort()
      .map(key => this.directories.get(key)!);
  }
  @computed
  get sortedFiles() {
    return Array.from(this.files.keys())
      .sort()
      .map(key => this.files.get(key)!);
  }

  @computed
  get path() {
    return normalize(this.props.path);
  }
  @computed
  get root() {
    return normalize(this.props.root);
  }
  @computed
  get absolutePath(): string {
    return join(this.props.root, this.props.path);
  }
  @action
  RemoveFile(fname: string) {
    let file = this.files.get(fname);
    if (!file) return;
    file.destructor();
    this.files.delete(fname);
  }
  @action
  RemoveDirectory(fname: string) {
    let directory = this.directories.get(fname);
    if (!directory) return;
    directory.destructor();
    this.directories.delete(fname);
  }
  @action
  AddFile(fname: string): File | null {
    this.RemoveDirectory(fname);
    if (this.files.has(fname)) return null;
    const FileClass = this.FileClass();
    let file = new FileClass({root: this.props.root, path: join(this.path, fname)});
    this.files.set(fname, file);
    return file;
  }
  @action
  AddDirectory(fname: string): Directory | null {
    this.RemoveFile(fname);
    if (this.directories.has(fname)) return null;
    const DirectoryClass = this.DirectoryClass();
    let directory = new DirectoryClass({
      root: this.props.root,
      path: join(this.path, fname),
    });
    this.directories.set(fname, directory);
    return directory;
  }
  IsFile() {
    return false;
  }
  IsDirectory() {
    return true;
  }
  FileClass() {
    return File;
  }
  DirectoryClass() {
    return Directory;
  }

  Each(callback: (file: File) => void) {
    this.sortedDirectories.forEach(dir => {
      dir.Each(callback);
    });
    this.sortedFiles.forEach(file => {
      callback(file);
    });
  }

  constructor(props: IDirectoryProps) {
    this.props = props;
  }
  @action
  destructor() {
    for (let fname of this.directories.keys()) this.RemoveDirectory(fname);
    for (let fname of this.files.keys()) this.RemoveFile(fname);
    this.disposers.reverse().forEach(d => d());
    this.disposers = [];
  }
}
