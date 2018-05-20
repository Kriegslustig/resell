// @flow

import mkSelect from 'resell-select'
import type { Select, Selector, Node } from 'resell-select'
import { Observable } from 'rxjs'
import * as rx from 'rxjs/operators'

type PuppeteerPage = Object
type PuppeteerJSHandle = {
  asElement: () => ?PuppeteerElementHandle,
}
type PuppeteerElementHandle = Object

export type Options = {|
  page: PuppeteerPage,
  rootId: string,
|}

const init = ({ page, rootId }: Options): Observable<Resell> =>
  Observable.fromPromise(
    page.evaluate(
      (mkSelectStr, _rootNodeId) => {
        const rootNode = document.getElementById(_rootNodeId)
        if (!rootNode) throw new Error(`Root node with id "${_rootNodeId}" not found`)

        const _mkSelect: Function = new Function(`return ${mkSelectStr}`)
        const select: Select = _mkSelect()()
        const selectRoot = select.fromRoot(rootNode)

        if (!selectRoot.reactNode) throw new Error('No react instance found on root node')

        window.__RESELL_SELECT_ROOT__ = selectRoot
      },
      mkSelect.toString(),
      rootId
    )
  ).pipe(
    rx.map(() => mkResell(page))
  )

type ResellElement = {|
  click: () => Observable<ResellElement>,
  type: (string) => Observable<ResellElement>,
|}

export interface Resell {
  (Selector): ResellElement,
  waitFor: (Selector) => Observable<ResellElement>,
  drain: () => Observable<mixed>,
  screenshot: (options?: Object) => Observable<void>,

  _queue: Array<Observable<mixed>>,
  _queryElementHandle: (Selector) => PuppeteerElementHandle,
}

const mkResell = (page: PuppeteerPage): Resell => {
  const mkResellElement = (query: Selector): ResellElement => {
    const runOnHandle = (action) => {
      resell._queue.push(
        resell._queryElementHandle(query).pipe(
          rx.switchMap((handle: PuppeteerElementHandle) =>
            action(handle)
          )
        )
      )

      return resell.drain().pipe(
        rx.mapTo(element)
      )
    }

    const element = {
      click: () =>
        runOnHandle(async (handle: PuppeteerElementHandle) => {
          await handle.click()
        }),

      type: (text: string) =>
        runOnHandle(async (handle: PuppeteerElementHandle) => {
          await handle.type(text)
        }),
    }

    return element
  }

  const resell = (query: Selector) => mkResellElement(query)

  resell._queryElementHandle = (query: Selector) => Observable.create((o) => {
    Observable.fromPromise(
      page.evaluateHandle(
        (query) => {
          const node: ?Node = window.__RESELL_SELECT_ROOT__.query(query)
          return node && node.domNode
        },
        query
      )
    ).pipe(
      rx.map((handle: PuppeteerJSHandle) => {
        const element = handle.asElement()
        if (!element) return o.error(new Error(`Element not found. selector: ${query}`))
        return element
      })
    ).subscribe(o)
  })

  resell.waitFor = (query: Selector) => {
    resell._queue.push(Observable.create((o) => {
      Observable.fromPromise(
        page.evaluateHandle(
          async (query: Selector) => {
            return await window.__RESELL_SELECT_ROOT__.waitFor(query)
          },
          query
        )
      ).pipe(
        rx.map((handle: PuppeteerJSHandle) => {
          const element = handle.asElement()
          if (!element) return o.error(new Error('Element not found'))
          return element
        })
      ).subscribe(o)
    }))

    return resell.drain().pipe(
      rx.takeLast(1)
    )
  }

  resell.screenshot = (options) => {
    const defaultOptions = {
      fullPage: true,
      path: 'screenshot.png',
    }

    resell._queue.push(
      Observable.create((o) => {
        Observable.fromPromise(
          page.screenshot(Object.assign({}, options, defaultOptions))
        )
          .subscribe(o)
      })
    )

    return resell.drain().pipe(
      rx.toArray(),
      rx.mapTo(null)
    )
  }

  resell.drain = () => Observable.of(true).pipe(
    rx.switchMap(() => Observable.from(resell._queue)),
    rx.concatAll()
  )
  resell._queue = []

  return resell
}

export default init
