import { composite, fdValue, generateNode, nodeWrapper } from '../../../src';

const first = fdValue(0)
const second = fdValue(0)

const element = generateNode(nodeWrapper(
    {
        tag: "div",
        classList: "first",
        textValue: first,
        listeners: {
            click: () => {
                first.value += 1
            }
        },
    },
    {
        tag: "div",
        classList: "second",
        textValue: second,
        listeners: {
            click: () => {
                second.value += 1
            }
        },
    },
    {
        tag: "p",
        textValue: composite([first, second], (a, b) => a + b)
    }))
document.body.appendChild(element);