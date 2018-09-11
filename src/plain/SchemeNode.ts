import {Operator} from "./Operator";

export class SchemeNode {
  path: string = "";
  operator: Operator = Operator.MERGE;
  children: SchemeNode[] = [];
}
