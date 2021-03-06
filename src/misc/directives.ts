import { asyncCall, callDeep, isPrimitive, removeAllChild, renderList } from './misc';

import { Observer } from '../observer/observer';
import { RevactNode } from '../interfaces/node';
import { generateNode } from '../generators/node';

export function rValue(value: any, force = false) {
  return new Observer(value, force);
}

function mapFn<F extends Array<any>>(
  item: any,
  itemFn: (...args: Array<any>) => RevactNode,
  inputs: F = [] as any,
  index: number,
  keyFn?: (item: any) => string,
) {
  let isPrim = false;
  let newItem: any;
  let skopedKeyFn: (iten: any) => any;
  if (keyFn) {
    skopedKeyFn = keyFn;
    newItem = item;
  } else {
    isPrim = isPrimitive(item);
    newItem = isPrim ? { id: index, value: item } : item;
    skopedKeyFn = () => newItem;
  }
  if (typeof itemFn === 'function') {
    return {
      ...itemFn(
        ...inputs.map(inputValue => {
          if (typeof inputValue === 'function') {
            return inputValue(isPrim ? newItem.value : item);
          }
          return inputValue;
        }),
        index,
      ),
      fdKey: skopedKeyFn(newItem),
    };
  }
  return {
    ...(itemFn as RevactNode),
    textValue: (itemFn as any).textValue(isPrim ? newItem.value : item),
    fdKey: skopedKeyFn(newItem),
  };
}

export function rList<F extends any[]>(
  iteration: Observer<Array<any>> | Array<any>,
  itemFn: (...args: Array<any>) => RevactNode,
  inputs: F = [] as any,
  keyFn?: (e: any) => string,
) {
  if (Array.isArray(iteration)) {
    return iteration.map((item: any, index) => mapFn(item, itemFn, inputs, index, keyFn));
  }

  const mapKeyFnIndex = new Map<any, number>();

  let responseArray = iteration.value.map((item: any, index: number) => {
    const el = mapFn(item, itemFn, inputs, index, keyFn);
    mapKeyFnIndex.set(el.fdKey, index);
    return el;
  });

  iteration.addSubscriber(value => {
    const parent: HTMLElement = (responseArray as any)._parent;
    const oldLength = responseArray.length;
    if (value.length === 0) {
      if (oldLength) {
        removeAllChild(parent);
        const arrToDestroy = responseArray.slice();
        asyncCall(() => {
          arrToDestroy.forEach(item => {
            callDeep(item, 'destroy', true, true);
          });
        });
      }
      responseArray = value;
      mapKeyFnIndex.clear();
      (responseArray as any)._parent = parent;
      return;
    }
    if (oldLength === 0) {
      responseArray = value.map((item: any, index) => {
        const el = mapFn(item, itemFn, inputs, index, keyFn);
        mapKeyFnIndex.set(el.fdKey, index);
        return el;
      });
      const frArr = [] as Array<HTMLElement>;
      responseArray.forEach(item => {
        frArr.push(generateNode(item) as HTMLElement);
      });
      renderList(parent, frArr);
      (responseArray as any)._parent = parent;
      return;
    }
    const arrForDestroy = [] as Array<any>;
    const newArr = value.map((item: any, index) => mapFn(item, itemFn, inputs, index, keyFn));
    const arr = [];
    for (let i = 0; i < oldLength; i++) {
      arr.push(false);
    }
    const tempArr = newArr.map(item => {
      const index = mapKeyFnIndex.get(item.fdKey);
      if (index !== undefined) {
        return [item, index];
      }
      return [item, -1];
    });
    tempArr.forEach(el => {
      const oldIndex = el[1] as number;
      if (oldIndex > -1) {
        arr[oldIndex] = true;
      }
    });
    arr.forEach((item, index) => {
      if (!item) {
        parent.removeChild(responseArray[index].domNode);
        arrForDestroy.push(responseArray[index]);
      }
    });
    asyncCall(() => {
      arrForDestroy.forEach(item => {
        callDeep(item, 'destroy', true, true);
      });
    });
    let increaseIndex = 0;
    const fragmentArr = [] as Array<HTMLElement>;
    tempArr.forEach((el, index) => {
      const item = el[0] as RevactNode;
      const oldIndex = el[1] as number;
      if (oldIndex === -1) {
        fragmentArr.push(generateNode(item) as HTMLElement);
        increaseIndex += 1;
        return;
      }
      if (responseArray[oldIndex].domNode !== parent.children[index + increaseIndex]) {
        parent.insertBefore(
          responseArray[oldIndex].domNode,
          parent.children[index + increaseIndex],
        );
        increaseIndex += 1;
      }
    });
    renderList(parent, fragmentArr);
    mapKeyFnIndex.clear();
    newArr.forEach((item, index) => {
      item.domNode = parent.children[index] as HTMLElement;
      mapKeyFnIndex.set(item.fdKey, index);
    });
    responseArray = newArr;
    (responseArray as any)._parent = parent;
  }, false);

  return responseArray;
}
