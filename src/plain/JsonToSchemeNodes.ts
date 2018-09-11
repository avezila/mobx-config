import {Operator} from "./Operator";
import {Err} from "../Err/Err";

export function JsonToSchemeNodes(json: any) {}

export function calcOperatorByJson(json: any, key?: string): [Operator?, Err?] {
  if (key && key[0] === "$") {
    key = key.toLowerCase();
    if (key in Operator) return [key as Operator];
    return [, new Err(`Неизвестный оператор '${key}'`)];
  }

  return [, new Err(`Неизвестный формат конфига`, [], {ключ: key, конфиг: json})];
}
