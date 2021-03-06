/**
 * @module bindings/textarea
 */

import { createMutex } from 'lib0/mutex.js'
import * as math from 'lib0/math.js'
import * as Y from 'yjs'
import * as func from 'lib0/function.js'
import * as eventloop from 'lib0/eventloop.js'
import * as diff from 'lib0/diff.js'
import CodeMirror from 'codemirror'
//import * as Ys from './RelativePosition.js'

// import {getState, followRedone, Item} from 'yjs/src/internals.js'

const debug = false;

export const cmOrigin = 'prosemirror-binding'

/**
 * @param {CodemirrorBinding} binding
 * @param {any} event
 */
const typeObserver = (binding, event) => {
  binding._mux(() => {
    const cmDoc = binding.cmDoc
    const cm = cmDoc.getEditor()
    // Normally the position is right-associated
    // But when remote changes happen, it looks like the remote user is hijacking your position.
    // Just for remote insertions, we make the collapsed cursor left-associated.
    // If selection is not collapsed, we only make "to" left associated
    let anchor = cm.indexFromPos(cm.getCursor('anchor'))
    let head = cm.indexFromPos(cm.getCursor('head'))
    const switchSel = head < anchor
    // normalize selection so that anchor < head, switch back later
    if (switchSel) {
      const tmp = head
      head = anchor
      anchor = tmp
    }
    const performChange = () => {
      const delta = event.delta
      let index = 0
      for (let i = 0; i < event.delta.length; i++) {
        const d = delta[i]
        if (d.retain) {
          index += d.retain
        } else if (d.insert) {
          if (index < anchor || (anchor < head && index === anchor)) {
            anchor += d.insert.length
          }
          if (index < head) {
            head += d.insert.length
          }
          const pos = cmDoc.posFromIndex(index)
          cmDoc.replaceRange(d.insert, pos, pos, cmOrigin)
          index += d.insert.length
        } else if (d.delete) {
          if (index < anchor) {
            anchor = math.max(anchor - d.delete, index)
          }
          if (index < head) {
            head = math.max(head - d.delete, index)
          }
          const start = cmDoc.posFromIndex(index)
          const end = cmDoc.posFromIndex(index + d.delete)
          cmDoc.replaceRange('', start, end, cmOrigin)
        }
      }
    }
    // if possible, bundle the changes using cm.operation
    if (cm) {
      cm.operation(performChange)
    } else {
      performChange()
    }
    if (switchSel) {
      const tmp = head
      head = anchor
      anchor = tmp
    }
    cm.setSelection(cm.posFromIndex(anchor), cm.posFromIndex(head))
  })
}

const targetObserver = (binding, changes) => {
  binding._mux(() => {
    binding.doc.transact(() => {
      if (changes.length > 1) {
        // If there are several consecutive changes, we can't reliably compute the positions anymore. See y-codemirror#11
        // Instead, we will compute the diff and apply the changes
        const d = diff.simpleDiffString(binding.type.toString(), binding.cmDoc.getValue())
        binding.type.delete(d.index, d.remove)
        binding.type.insert(d.index, d.insert)
      } else {
        const change = changes[0]
        const start = binding.cmDoc.indexFromPos(change.from)
        const delLen = change.removed.map(s => s.length).reduce(math.add) + change.removed.length - 1
        if (delLen > 0) {
          binding.type.delete(start, delLen)
        }
        if (change.text.length > 0) {
          binding.type.insert(start, change.text.join('\n'))
        }
      }
    }, binding)
  })
}

const createRemoteCaret = (username, color) => {
  const caret = document.createElement('span')
  caret.classList.add('remote-caret')
  caret.setAttribute('style', `border-color: ${color}`)
  const userDiv = document.createElement('div')
  userDiv.setAttribute('style', `background-color: ${color}`)
  userDiv.insertBefore(document.createTextNode(username), null)
  caret.insertBefore(userDiv, null)
  setTimeout(() => {
    caret.classList.add('hide-name')
  }, 2000)
  return caret
}

const createEmptyLinePlaceholder = (color) => {
  const el = document.createElement('span')
  el.setAttribute('class', 'y-line-selection')
  el.setAttribute('style', `display: inline-block; position: absolute; left: 4px; right: 4px; top: 0; bottom: 0; background-color: ${color}70`)
  return el
}

// const testingFunc = (rpos, doc) => {
//   const store = doc.store
//   const rightID = rpos.item
//   const typeID = rpos.type
//   const tname = rpos.tname
//   let type = null
//   let index = 0
//   if (rightID != null) {
//     if (getState(store, rightID.client) <= rightID.clock) {
//       return null
//     }
//     const res = followRedone(store, rightID)
//     const right = res.item
//     // if (!(right instanceof Item)) {
//     //   return null
//     // }
//     type = /** @type {AbstractType<any>} */ (right.parent)
//     if (type._item === null || !type._item.deleted) {
//       index = right.deleted || !right.countable ? 0 : res.diff
//       let n = right.left
//       while (n !== null) {
//         if (!n.deleted && n.countable) {
//           index += n.length
//         }
//         n = n.left
//       }
//     }
//   }
  
//   console.log('00000000000000000000000000000000000000000000000000000000000')
//   console.log(type, index);
// }

//comment by jeanMendoza 17/10/2020
// const updateRemoteSelection = (y, cm, type, cursors, clientId, awareness) => {
//   // redraw caret and selection for clientId
//   const aw = awareness.getStates().get(clientId)
//   // destroy current text mark
//   const m = cursors.get(clientId)
//   if (m !== undefined) {
//     if (m.caret) {
//       m.caret.clear()
//     }
//     m.sel.forEach(sel => sel.clear())
//     cursors.delete(clientId)
//   }
//   if (aw === undefined) {
//     return
//   }
//   const user = aw.user || {}
//   if (user.color == null) {
//     user.color = '#ffa500'
//   }
//   if (user.name == null) {
//     user.name = `User: ${clientId}`
//   }
//   const cursor = aw.cursor
//   if (cursor == null || cursor.anchor == null || cursor.head == null) {
//     return
//   }

//   // testingFunc(JSON.parse(cursor.anchor), y);  
//   // Ys
  
//   const anchor = Ys.createAbsolutePositionFromRelativePosition(JSON.parse(cursor.anchor), y)
//   const head = Ys.createAbsolutePositionFromRelativePosition(JSON.parse(cursor.head), y)
//   // const anchor = Y.createAbsolutePositionFromRelativePosition(JSON.parse(cursor.anchor), y)
//   // const head = Y.createAbsolutePositionFromRelativePosition(JSON.parse(cursor.head), y)
//   if (anchor !== null && head !== null && anchor.type === type && head.type === type) {
//     const headpos = cm.posFromIndex(head.index)
//     const anchorpos = cm.posFromIndex(anchor.index)
//     let from, to
//     if (head.index < anchor.index) {
//       from = headpos
//       to = anchorpos
//     } else {
//       from = anchorpos
//       to = headpos
//     }
//     const caretEl = createRemoteCaret(user.name, user.color)
//     // if position was "relatively" the same, do not show name again and hide instead
//     if (m && func.equalityFlat(aw.cursor.anchor, m.awCursor.anchor) && func.equalityFlat(aw.cursor.head, m.awCursor.head)) {
//       caretEl.classList.add('hide-name')
//     }
//     const sel = []

//     if (head.index !== anchor.index) {
//       if (from.line !== to.line && from.ch !== 0) {
//         // start of selection will only be a simple text-selection
//         sel.push(cm.markText(from, new CodeMirror.Pos(from.line + 1, 0), { css: `background-color: ${user.color}70;`, inclusiveRight: false, inclusiveLeft: false }))
//         from = new CodeMirror.Pos(from.line + 1, 0)
//       }
//       while (from.line !== to.line) {
//         // middle of selection is always a whole-line selection. We add a widget at the first position which will fill the background.
//         sel.push(cm.setBookmark(new CodeMirror.Pos(from.line, 0), { widget: createEmptyLinePlaceholder(user.color) }))
//         from = new CodeMirror.Pos(from.line + 1, 0)
//       }
//       sel.push(cm.markText(from, to, { css: `background-color: ${user.color}70;`, inclusiveRight: false, inclusiveLeft: false }))
//     }
//     // only render caret if not the complete last line was selected (in this case headpos.ch === 0)
//     const caret = sel.length > 0 && to === headpos && headpos.ch === 0 ? null : cm.setBookmark(headpos, { widget: caretEl, insertLeft: true })
//     cursors.set(clientId, { caret, sel, awCursor: cursor })
//   }
// }
const updateRemoteSelection = (y, cm, type, cursors, clientId, awareness) => {
  // destroy current text mark
  const m = cursors.get(clientId)
  if (m !== undefined) {
    m.caret.clear()
    if (m.sel !== null) {
      m.sel.clear()
    }
    cursors.delete(clientId)
  }
  // redraw caret and selection for clientId
  const aw = awareness.getStates().get(clientId);
  if (aw === undefined) {
    return
  }
  const user = aw.user || {}
  if (user.color == null) {
    user.color = '#ffa500'
  }
  if (user.name == null) {
    user.name = `User: ${clientId}`
  }
  const cursor = aw.cursor
  if (cursor == null || cursor.anchor == null || cursor.head == null) {
    return
  }
  console.log(cursor.anchor)
  let cursor_anchor = typeof cursor.anchor == 'object' ? cursor.anchor : JSON.parse(cursor.anchor);
  const anchor = Y.createAbsolutePositionFromRelativePosition(cursor_anchor, y)

  // const anchor = Ys.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(cursor.anchor), y)
  let cursor_head = typeof cursor.head == 'object' ? cursor.head : JSON.parse(cursor.head);
  const head = Y.createAbsolutePositionFromRelativePosition(cursor_head, y)
  // const head = Ys.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(cursor.head), y)

  /*console.log("TYPE comparation ",anchor.type == type)
  console.log("TYPE  ",type)
  console.log("TYPE  anchor ",anchor.type)*/
  if (anchor !== null && head !== null && anchor.type === type && head.type === type) {
    const headpos = cm.posFromIndex(head.index)
    const anchorpos = cm.posFromIndex(anchor.index)
    let from, to
    if (head.index < anchor.index) {
      from = headpos
      to = anchorpos
    } else {
      from = anchorpos
      to = headpos
    }
    if(debug)
    console.log(" From ",from," to ",to)
    //console.log("awareness ",awareness)
    const caretEl = createRemoteCaret(user.name, user.color)
    const caret = cm.setBookmark(headpos, { widget: caretEl, insertLeft: true })
    let sel = null
    if (head.index !== anchor.index) {
      sel = cm.markText(from, to, { css: `background-color: ${user.color}70`, inclusiveRight: true, inclusiveLeft: false })
    }
    cursors.set(clientId, { caret, sel })
    if(debug)
      console.log("updateRemoteSelection from codemirror ")
    
  }
}



/// comment by jean mendoza 17/10/2020
// const codemirrorCursorActivity = (y, cm, type, awareness) => {
//   const aw = awareness.getLocalState()
//   if (!cm.hasFocus() || aw == null || !cm.display.wrapper.ownerDocument.hasFocus()) {
//     return
//   }
//   const newAnchor = Y.createRelativePositionFromTypeIndex(type, cm.indexFromPos(cm.getCursor('anchor')))
//   const newHead = Y.createRelativePositionFromTypeIndex(type, cm.indexFromPos(cm.getCursor('head')))
//   let currentAnchor = null
//   let currentHead = null
//   if (aw.cursor != null) {
//     currentAnchor = Y.createRelativePositionFromJSON(JSON.parse(aw.cursor.anchor))
//     currentHead = Y.createRelativePositionFromJSON(JSON.parse(aw.cursor.head))
//   }
//   if (aw.cursor == null || !Y.compareRelativePositions(currentAnchor, newAnchor) || !Y.compareRelativePositions(currentHead, newHead)) {
//     awareness.setLocalStateField('cursor', {
//       anchor: JSON.stringify(newAnchor),
//       head: JSON.stringify(newHead)
//     })
//   }
// }

const codemirrorCursorActivity = (y, cm, type, awareness) => {
  if (!cm.hasFocus()) {
    return
  }
  if(debug){
    console.log("codemirrorCursorActivity start ",cm.indexFromPos(cm.getCursor('anchor'))," end ",cm.indexFromPos(cm.getCursor('head')))
    console.log(" Type codemirror ",type)
    
  }
  const newAnchor = Y.createRelativePositionFromTypeIndex(type, cm.indexFromPos(cm.getCursor('anchor')))
  const newHead = Y.createRelativePositionFromTypeIndex(type, cm.indexFromPos(cm.getCursor('head')))
  const aw = awareness.getLocalState()
  let currentAnchor = null
  let currentHead = null
  if (aw.cursor != null) {
    currentAnchor = aw.cursor.anchor;// Y.createAbsolutePositionFromRelativePosition(JSON.parse(aw.cursor.anchor), y)
    currentHead = aw.cursor.head; // Y.createAbsolutePositionFromRelativePosition(JSON.parse(aw.cursor.head), y)
  }
  if (aw.cursor == null || !Y.compareRelativePositions(currentAnchor, newAnchor) || !Y.compareRelativePositions(currentHead, newHead)) {
    awareness.setLocalStateField('cursor', {
      anchor: newAnchor,
      head: newHead
    })
    if(debug)
      console.log("Send cursor  from codemirrorCursorActivity  ",{
          anchor: newAnchor,
          head: newHead
        })  
  }else {
    let start = cm.indexFromPos(cm.getCursor('anchor'));
    let end = cm.indexFromPos(cm.getCursor('head'));
    if(debug)
    console.log("Else codemirrorCursorActivity",start,end)  
    
    if(start == end){
        const newAnchor = Y.createRelativePositionFromTypeIndex(type, start);
        const newHead = Y.createRelativePositionFromTypeIndex(type, end);
        awareness.setLocalStateField('cursor', {
          anchor: newAnchor,
          head: newHead
        });
        if(debug)
          console.log("SEND Postion targetObserver  ",(start+end)) 
      }
      
  }
  
  //console.log('---------------------cm----------------------')
  //console.log(currentAnchor, currentHead, newAnchor, newHead);
}

/**
 * A binding that binds a YText to a CodeMirror editor.
 *
 * @example
 *   const ytext = ydocument.define('codemirror', Y.Text)
 *   const editor = new CodeMirror(document.querySelector('#container'), {
 *     mode: 'javascript',
 *     lineNumbers: true
 *   })
 *   const binding = new CodemirrorBinding(ytext, editor)
 *
 */
export class CodemirrorBinding {
  /**
   * @param {Y.Text} textType
   * @param {import('codemirror').Editor} codeMirror
   * @param {any} [awareness]
   */
  constructor (textType, codeMirror, awareness,realtime=true) {
    const doc = textType.doc
    const cmDoc = codeMirror.getDoc()
    this.doc = doc
    this.type = textType
    this.cm = codeMirror
    this.cmDoc = cmDoc
    this.awareness = awareness
    // this.undoManager = new Y.UndoManager(textType, { trackedOrigins: new Set([this]) })
    this._mux = createMutex()
    // set initial value
    console.log("---------------------",textType.toString())
    //cmDoc.setValue(textType.toString())
    // observe type and target
    this._typeObserver = event => typeObserver(this, event)
    this._targetObserver = (instance, changes) => {
      if (instance.getDoc() === cmDoc) {
        targetObserver(this, changes)
      }
    }
    this._cursors = new Map()
    this._changedCursors = new Set()
    this._debounceCursorEvent = eventloop.createDebouncer(10)
    this._awarenessListener = event => {
      if (codeMirror.getDoc() !== cmDoc) {
        return
      }
      const f = clientId => {
        if (clientId !== doc.clientID) {
          this._changedCursors.add(clientId)
        }
      }
      event.added.forEach(f)
      event.removed.forEach(f)
      event.updated.forEach(f)
      if (this._changedCursors.size > 0) {
        this._debounceCursorEvent(() => {
          this._changedCursors.forEach(clientId => {
            updateRemoteSelection(doc, codeMirror, textType, this._cursors, clientId, awareness)
          })
          this._changedCursors.clear()
        })
      }
    }
    this._cursorListener = () => {
      if (codeMirror.getDoc() === cmDoc) {
        setTimeout(() => {
          codemirrorCursorActivity(doc, codeMirror, textType, awareness)
        }, 0)
      }
    }
    this._blurListeer = () => awareness.setLocalStateField('cursor', null)

    textType.observe(this._typeObserver)
    // @ts-ignore
    if(realtime)
      codeMirror.on('changes', this._targetObserver)
    if (awareness) {
      codeMirror.on('swapDoc', this._blurListeer)
      awareness.on('change', this._awarenessListener)
      // @ts-ignore
      codeMirror.on('cursorActivity', this._cursorListener)
      codeMirror.on('blur', this._blurListeer)
      codeMirror.on('focus', this._cursorListener)
    }
  }

  destroy () {
    this.type.unobserve(this._typeObserver)
    this.cm.off('swapDoc', this._blurListeer)
    // @ts-ignore
    this.cm.off('changes', this._targetObserver)
    // @ts-ignore
    this.cm.off('cursorActivity', this._cursorListener)
    this.cm.off('focus', this._cursorListener)
    this.cm.off('blur', this._blurListeer)
    if (this.awareness) {
      this.awareness.off('change', this._awarenessListener)
    }
    this.type = null
    this.cm = null
    this.cmDoc = null
    // this.undoManager.destroy()
  }
}



export const CodeMirrorBinding = CodemirrorBinding
