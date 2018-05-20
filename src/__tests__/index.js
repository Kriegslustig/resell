// @flow

import { Observable } from 'rxjs'
import * as rx from 'rxjs/operators'
import * as React from 'react'

import type { Node } from 'resell-select'

jest.mock('resell-select', () => {
  const mkSelect = () => ({
    fromRoot: () => {
      const node = {
        reactNode: {},
        _clicked: false,
        _typed: '',
        query: () => ({
          _isElement: true,
          domNode: {
            clicked: false,
            click: async () => {
              node._clicked = true
            },

            type: async (text: string) => {
              node._typed += text
            },
          }
        }),

        _waitedFor: null,
        waitFor: (query) => new Promise((res) => {
          node._waitedFor = query
          res({ domNode: { _isElement: true } })
        })
      }

      return node
    }
  })

  return mkSelect
})
const mkSelect = require('resell-select')
const mkResell = require('../').default

global.requestAnimationFrame = (fn) => setTimeout(fn)
const { render } = require('react-dom')

const root = document.createElement('div')
root.setAttribute('id', 'root')
if (!document.body) throw new Error()
document.body.appendChild(root)

const mkPuppeteerPage = () => ({
  screenshot: jest.fn(async () => {}),
  evaluate: jest.fn(async (fn, ...args) => {
    return await fn(...args)
  }),
  evaluateHandle: async (fn, ...args) => {
    const el = await fn(...args)
    return { asElement: () => el }
  }
})

let renderedOnce = false
const setup = async () => {
  const page = mkPuppeteerPage()
  const $ = await mkResell({ page, rootId: 'root' }).toPromise()
  const selectNode: Node = (window.__RESELL_SELECT_ROOT__: any)
  return { $, page, selectNode }
}

const page = mkPuppeteerPage()

describe('mkResell', () => {
  it('should return a promise resolves to a function', async () => {
    await setup()
    const page = mkPuppeteerPage()

    const result = mkResell({ page, rootId: 'root' }).toPromise()

    await expect(result).resolves.toBeInstanceOf(Function)
  })

  it('should install a global containing a resell node', async () => {
    await setup()
    expect(window.__RESELL_SELECT_ROOT__).toBeDefined()
  })
})

describe('$()', () => {
  it('should return a resell element', async () => {
    const { $ } = await setup()
    const result = $('h1')
    expect(result).toHaveProperty('click')
  })
})

describe('ResellElement.click', () => {
  it('should click on a the element', async () => {
    const { $, selectNode } = await setup()
    await $('h1').click().toPromise()
    expect(selectNode._clicked).toBe(true)
  })
})

describe('$.drain', () => {
  it('should run all commands in the queue', async () => {
    const { $ } = await setup()
    const obs1 = jest.fn()
    const obs2 = jest.fn()
    $._queue.push(Observable.of(true).pipe(rx.tap(obs1)))
    $._queue.push(Observable.of(true).pipe(rx.tap(obs2)))

    $.drain().subscribe()

    expect(obs1).toHaveBeenCalled()
    expect(obs2).toHaveBeenCalled()
  })
})

describe('$.waitFor', () => {
  it('should wait until an element is there and then emit it', async () => {
    const { $, selectNode } = await setup()
    const next = jest.fn()

    const result = await $.waitFor('a').toPromise()

    expect(result).toEqual({ _isElement: true })
    expect(selectNode._waitedFor).toBe('a')
  })
})

describe('ResellElement.type', () => {
  it('should type the given text into an element', async () => {
    const { $, selectNode } = await setup()
    await $('h1').type('my text').toPromise()
    expect(selectNode._typed).toBe('my text')
  })
})

describe('$.screenshot', () => {
  it('should create a screenshot', async () => {
    const { $, page } = await setup()
    await $.screenshot().toPromise()
    expect(page.screenshot).toHaveBeenCalledWith({
      path: 'screenshot.png',
      fullPage: true,
    })
  })
})
