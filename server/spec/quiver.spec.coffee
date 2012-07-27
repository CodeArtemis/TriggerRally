# Copyright (C) 2012 jareiko / http://www.jareiko.net/



describe "quiver", ->

  quiver = require "../public/scripts/util/quiver"

  describe "Lock", ->
    it "knows when it's locked", (done) ->
      lock = new quiver.Lock()
      expect(lock.isLocked()).toBe false
      lock.acquire (release) ->
        expect(lock.isLocked()).toBe true
        release()
        expect(lock.isLocked()).toBe false
        done()

    it "queues up calls to acquire", (done) ->
      lock = new quiver.Lock()
      lock.acquire (release1) ->
        lock.acquire (release2) ->
          release2()
          expect(lock.isLocked()).toBe false
          done()
        expect(lock.queue.length).toBe 2
        release1()

  describe "LockedSet", ->
    it "locks each node once", (done) ->
      ls = new quiver.LockedSet
      n = new quiver.Node
      ls.acquireNode n, ->
        ls.acquireNode n, ->
          expect(n.lock.queue.length).toBe 1
          ls.release()
          expect(n.lock.isLocked()).toBe false
          done()

  describe "Node", ->
    describe "_walkOut", ->
      it "can walk a simple graph", (done) ->
        quiver.connect(
          n1 = new quiver.Node
          n2 = new quiver.Node
        )
        info = {}
        ls = new quiver.LockedSet()
        quiver._walkOut n1, info, ls, ->
          ls.release()
          expect(info[n2.id].deps).toEqual [n1.id + ""]
          done()

      it "follows parallel paths", (done) ->
        quiver.connectParallel(
          n1 = new quiver.Node
          [{}, {}]
          n2 = new quiver.Node
        )
        info = {}
        ls = new quiver.LockedSet()
        quiver._walkOut n1, info, ls, ->
          ls.release()
          expect(info[n2.id].deps.length).toBe 2
          done()

    describe "trigger", ->
      it "executes each node exactly once", (done) ->
        count = 0
        makeNode = ->
          count += 1
          return new quiver.Node (ins, outs, callback) ->
            count -= 1
            callback()
        quiver.connectParallel(
          n1 = makeNode()
          [makeNode(), makeNode()]
          makeNode()
          (ins, outs, callback) ->
            expect(count).toBe 0
            done()
        )
        quiver.trigger n1
