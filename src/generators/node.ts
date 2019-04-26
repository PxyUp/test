import {
  addNodeListener,
  callDeep,
  removeNodeListener,
  renderList,
  setNodeAttrs,
  setNodeStyle,
  setProps,
} from '../misc/misc';

import { FastDomNode } from '../interfaces/node';
import { Observer } from '../observer/observer';
import { fdObject } from '../observer/fdObject';

const instance = 'instance';

export function nodeWrapper(...args: any[]): FastDomNode {
  return {
    tag: 'fragment',
    children: args,
  };
}

export function generateNode(node: FastDomNode): HTMLElement | DocumentFragment | Comment | null {
  if (node.show === false) {
    return null;
  }
  let rootNode: HTMLElement | Text | DocumentFragment;

  if (node.tag === 'textNode') {
    rootNode = document.createTextNode('');
  }

  if (node.tag === 'fragment') {
    rootNode = document.createDocumentFragment();
  }

  if (node.tag !== 'textNode' && node.tag !== 'fragment') {
    rootNode = document.createElement(node.tag);
  }

  node.domNode = rootNode;

  if (node.textValue !== null || node.textValue !== undefined) {
    if (typeof node.textValue === 'object') {
      const obs = node.textValue;
      obs.addSubscriber(value => {
        rootNode.textContent = value;
      });
      rootNode.textContent = obs.value;
    } else {
      rootNode.textContent = node.textValue;
    }
  }
  let fdClassesNode: fdObject<boolean>;
  let fdAttrsNode: fdObject<any>;
  let fdPropsNode: fdObject<any>;
  let fdStyleNode: fdObject<any> | Observer<string>;

  if (node.tag !== 'textNode') {
    if (node.classList) {
      if (typeof node.classList === 'string') {
        (rootNode as HTMLElement).className = node.classList;
      } else {
        if (Array.isArray(node.classList)) {
          node.classList.forEach(item => {
            (rootNode as HTMLElement).classList.add(item);
          });
        } else {
          fdClassesNode = node.classList;
          const clsObs = node.classList.observer;
          Object.keys(clsObs.value).forEach(key => {
            const value = clsObs.value[key];
            return value
              ? (rootNode as HTMLElement).classList.add(key)
              : (rootNode as HTMLElement).classList.remove(key);
          });
          clsObs.addSubscriber(newClasses => {
            Object.keys(newClasses).forEach(key => {
              const value = newClasses[key];
              return value
                ? (rootNode as HTMLElement).classList.add(key)
                : (rootNode as HTMLElement).classList.remove(key);
            });
          });
        }
      }
    }

    if (node.props) {
      if (!(node.props instanceof fdObject)) {
        setProps(rootNode as HTMLElement, node.props);
      } else {
        fdPropsNode = node.props;
        const propsObs = node.props.observer;
        setProps(rootNode as HTMLElement, propsObs.value);
        propsObs.addSubscriber(newProps => {
          setProps(rootNode as HTMLElement, newProps);
        });
      }
    }

    if (node.styles) {
      if (!(node.styles instanceof fdObject)) {
        if (node.styles instanceof Observer) {
          fdStyleNode = node.styles;
          setNodeStyle(rootNode as HTMLElement, fdStyleNode.value);
          fdStyleNode.addSubscriber(newStyles => {
            setNodeStyle(rootNode as HTMLElement, newStyles);
          });
        } else {
          setNodeStyle(rootNode as HTMLElement, node.styles);
        }
      } else {
        fdStyleNode = node.styles;
        const styleObs = fdStyleNode.observer;
        setNodeStyle(rootNode as HTMLElement, styleObs.value);
        styleObs.addSubscriber(newStyles => {
          setNodeStyle(rootNode as HTMLElement, newStyles);
        });
      }
    }

    if (node.attrs) {
      if (!(node.attrs instanceof fdObject)) {
        setNodeAttrs(rootNode as HTMLElement, node.attrs);
      } else {
        fdAttrsNode = node.attrs;
        const attrsObs = node.attrs.observer;
        setNodeAttrs(rootNode as HTMLElement, attrsObs.value);
        attrsObs.addSubscriber(newAttrs => {
          setNodeAttrs(rootNode as HTMLElement, newAttrs);
        });
      }
    }

    if (node.children) {
      const tempArr = [] as Array<HTMLElement | DocumentFragment | Comment | Array<any>>;
      node.children.forEach((item: any) => {
        if (!item) {
          return;
        }
        if (Array.isArray(item)) {
          const tempSubArr = [] as Array<HTMLElement | Comment | DocumentFragment>;
          item.forEach(el => {
            if (!el.tag) {
              tempSubArr.push(el as HTMLHtmlElement);
              return;
            }
            const arrChild = generateNode(Object.assign(el, { parent: rootNode as any }) as any);
            if (arrChild) {
              tempSubArr.push(arrChild);
            }
          });
          (item as any)._parent = rootNode;
          tempArr.push(tempSubArr);
          return;
        }
        if (!item.tag) {
          tempArr.push(item);
          return;
        }
        const child = generateNode(Object.assign(item, { parent: rootNode as any }));
        if (child) {
          tempArr.push(child);
        }
      });
      renderList(rootNode as HTMLElement, tempArr);
    }

    if (node.listeners) {
      addNodeListener(rootNode as HTMLElement, node.listeners);
    }
  }

  if (node.instance) {
    (rootNode as any)[instance] = node.instance;
  }

  const fakeDestroy = () => {
    if (node.tag !== 'textNode') {
      removeNodeListener(rootNode as HTMLElement, node.listeners);
    }
    if (fdAttrsNode) {
      fdAttrsNode.destroy();
    }
    if (fdPropsNode) {
      fdPropsNode.destroy();
    }
    if (fdClassesNode) {
      fdClassesNode.destroy();
    }
    if (fdStyleNode) {
      fdClassesNode.destroy();
    }
    callDeep(node, 'destroy', true);
  };

  if (typeof node.show === 'object') {
    const comment = document.createComment('');
    node.show.addSubscriber(value => {
      const parent = node.parent ? node.parent : (null as HTMLElement);
      if (value) {
        if (parent) {
          if (comment.parentNode === parent) {
            parent.replaceChild(rootNode, comment);
          }
          callDeep(node, 'reInit', false);
          if (fdStyleNode) {
            fdClassesNode.reInit();
          }
          if (fdClassesNode) {
            fdClassesNode.reInit();
          }
          if (fdPropsNode) {
            fdPropsNode.reInit();
          }
          if (fdAttrsNode) {
            fdAttrsNode.reInit();
          }
          if (node.tag !== 'textNode') {
            addNodeListener(rootNode as HTMLElement, node.listeners);
          }
        }
      } else {
        if (parent) {
          fakeDestroy();
          if (rootNode.parentNode === parent) {
            parent.replaceChild(comment, rootNode);
          }
        }
      }
    });

    if (node.show.value) {
      if (node.instance) {
        node.instance.onInit();
      }
      return rootNode;
    } else {
      fakeDestroy();
      return comment;
    }
  }

  if (node.instance) {
    node.instance.onInit();
  }

  return rootNode;
}
