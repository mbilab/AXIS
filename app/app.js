const socket = io()

// global variables (default values)

const opt = {
  file: {},
  screen: {
    w: document.documentElement.clientWidth, //browser width
    h: document.documentElement.clientHeight, //browser height
  }
}

const app = {
  game: null
}

//////////////////////////////////////////////////////////////////////////////////////

// classes
const Game = function (){
  this.counter = 0
  this.currPage = 'login'

  this.default = {
    cardHeight: 91,
	  cardWidth: 64,
	  gameHeight: 700,
    gameWidth: 1366,
    scale: 768*(opt.screen.w/opt.screen.h)/1366
  }
  this.page = {
    login: [
      {x: this.default.gameWidth - 83, y: this.default.gameHeight*0.75, img: 'login', func: this.login, next: 'lobby'}
    ],
    signup: [],
    lobby: [
      {x: 0, y: 0, img: 'decks', func: this.changePage, next: 'deckBuild'},
      {x: 0, y: 43, img: 'battle', func: this.changePage, next: 'matchSearch'}
    ],
    deckBuild: [
      {x: 0, y: this.default.gameHeight - 43, img: 'back', func: this.changePage, next: 'lobby'}
    ],
    matchSearch: [
      {x: this.default.gameWidth - 88, y: this.default.gameHeight - 43, img: 'search', func: this.search, next: 'loading'},
      {x: 0, y: this.default.gameHeight - 43, img: 'back', func: this.changePage, next: 'lobby'}
    ],
    loading: [],
    game: [
      {x: this.default.gameWidth - 121, y: this.default.gameHeight/2 - 44/this.default.scale, img: 'endTurn', func: this.endTurn, next: null},
      {x: 0, y: this.default.gameHeight - 43, img: 'leave', func: this.leaveMatch, next: 'lobby'}
    ]
  }
  this.text = null
  this.textGroup = null
}

Game.prototype.changePage = function(btn){
  let oldPage = this.page[this.currPage]
  let newPage = this.page[btn.next]

  if(oldPage){
    for(let i in oldPage) {
      if(Array.isArray(oldPage[i])) {
        if(oldPage[i] == personal['deck'] || oldPage[i] == opponent['deck'])
          oldPage[i][0].face.kill()
        else
          for(let j in oldPage[i])
            oldPage[i][j].face.destroy()
      }
      else
        oldPage[i].kill()
    }
  }

  this.currPage = btn.next

  if(newPage){
    for(let i in newPage){
      if(!Array.isArray(newPage[i]))
        newPage[i].reset(newPage[i].x, newPage[i].y)
      else
        if(newPage[i] == personal['deck'] || newPage[i] == opponent['deck'])
          newPage[i][0].face.reset(newPage[i][0].face.x, newPage[i][0].face.y)
    }
  }
}

Game.prototype.cleanAllData = function(){
  let field = ['hand', 'life', 'grave', 'battle']
  this.text.setText(' ')
  for(let i in field){
    personal[field[i]].splice(0,personal[field[i]].length)
    opponent[field[i]].splice(0,opponent[field[i]].length)
  }
}

Game.prototype.endTurn = function(){
  socket.emit('finish', it => {this.text.setText(it.msg)})
}

Game.prototype.fixPos = function(player, field){
  if(player === "self"){
    for(let i in personal[field]){
      personal[field][i].face.x = (this.default.gameWidth/2) - this.default.cardWidth*1.25 - this.default.cardWidth/2 - (this.default.cardWidth*3/5)*(personal[field].length - 1) + (this.default.cardWidth*6/5)*i
   	  personal[field][i].face.y = personal[`${field}Yloc`]
    }
  }
  else{
    if(field !== 'deck')
      for(let i in opponent[field]){
        opponent[field][i].face.x = (this.default.gameWidth/2) - this.default.cardWidth*1.25 - this.default.cardWidth/2 - (this.default.cardWidth*3/5)*(opponent[field].length - 1) + (this.default.cardWidth*6/5)*i
  	    opponent[field][i].face.y = opponent[`${field}Yloc`]
      }
    else{
		  opponent[field][0].face.x = this.default.gameWidth*(1 - 1/13)
      opponent[field][0].face.y = opponent[`${field}Yloc`]
    }
  }
}

Game.prototype.leaveMatch = function(){
  socket.emit('leaveMatch')
  this.changePage({next:'lobby'})
  this.cleanAllData()
}

Game.prototype.login = function(){
  if($('#account').val()){
    socket.emit('login',  {acc: $('#account').val(), passwd: $('#passwd').val()}, it => {
      if(it.err) {
        alert(it.err)
        $('#account, #passwd').val('')
        return
      }

      self['deckList'] = it.deckList
      $('#login').remove()
      this.changePage({next: 'lobby'})
    })
  }
  else
    alert('please enter your account')
}

Game.prototype.pageInit = function(){
  for (let pageName in this.page) {
    let pageElem = []
    for (let [index, elem] of this.page[pageName].entries()) {
      if(this.page[pageName].length){
        pageElem.push(app.game.add.button(elem.x, elem.y, elem.img, elem.func, this))
        pageElem[index].next = elem.next
        pageElem[index].kill()
       }
    }
    this.page[pageName] = pageElem
  }

  for(let i of ['deck', 'hand', 'life', 'grave', 'battle']){
    this.page.game.push(personal[i])
    this.page.game.push(opponent[i])
    if(i === 'deck'){
      personal['deck'][0].face.kill()
      opponent['deck'][0].face.kill()
    }
  }
}

Game.prototype.search = function(){
  socket.emit('search', it => {
    this.text.setText(it.msg)
    if(it.msg !== 'searching for match...')
      this.changePage({next:'game'})
    else
      this.changePage({next:'loading'})
  })
}

const Card = function (name, field, faceInput, cover) {
  this.cover = cover
  this.face = app.game.add.sprite(game.default.gameWidth * (1 - 1/13), personal['deckYloc'], this.cover ? 'cardback' : name)
  this.face.inputEnabled = faceInput
  this.face.name = name
  this.field = field
  if(this.field === "deck")
    this.face.events.onInputDown.add(this.drawCard, this)
}

Card.prototype.activateCard = function(){
	this.changeInputFunction()
}

Card.prototype.changeInputFunction = function(){
  this.face.events.onInputDown.removeAll()

  switch (this.field) {
    case 'battle':
      if("artifact" === this.cardType)
        this.face.events.onInputDown.add(this.activateCard, this)
      break

    case 'deck':
      this.face.events.onInputDown.add(this.drawCard, this)
      break

    case 'hand':
      if ("vanish" !== this.face.name)
        this.face.events.onInputDown.add(this.playHandCard, this)
      break

    case 'life':
      if (this.cover) {
        this.face.events.onInputDown.add(this.checkCard, this)
        this.face.loadTexture('cardback')
      }
      else {
        this.face.loadTexture(this.face.name)
        if ("vanish" !== this.face.name)
          this.face.events.onInputDown.add(this.playLifeCard, this)
      }
      break
  }
}

Card.prototype.checkCard = function(){
  game.text.setText(`This is ${this.face.name}`);
  // change to => hover card for couple secs, and show the card's face sprite beside
}

Card.prototype.drawCard = function(){
	socket.emit('drawCard', it => {
    if(it.err) return game.text.setText(it.err)

    game.text.setText(`draw ${it.cardName}`)
    personal['hand'].push(new Card(it.cardName, 'hand', true, false))
    personal['hand'][personal['hand'].length - 1].changeInputFunction()
    game.fixPos("self", "hand")

    if(it.deckStatus === "empty")
      personal['deck'][0].face.kill()
  })
}

Card.prototype.playHandCard = function(){
  socket.emit('playHandCard', {name: this.face.name}, it => {
    if(it.err) return game.text.setText(it.err)

    game.text.setText(`play ${this.face.name}`)
    for(let i in personal['hand']){
	    if(personal['hand'][i].face.name === this.face.name){
	      personal['battle'].push(personal['hand'][i])
	      personal['hand'][i].face.destroy
        personal['hand'].splice(i,1)
	      break
      }
	  }
	  personal['battle'][personal['battle'].length -1].field = 'battle'
    personal['battle'][personal['battle'].length -1].changeInputFunction()
    game.fixPos('self', 'hand')
    game.fixPos('self', 'battle')
  })
}

const Player = function(obj){
  for (let field of ['deckY', 'handY', 'lifeY', 'battleY', 'graveY'])
    this[`${field}loc`] = game.default.gameHeight - obj[field] / game.default.scale

  this.deck = []
  this.deck.name = ''
  this.deckList = {}
  this.hand = []
  this.life = []
  this.battle = []
  this.grave = []
}

//////////////////////////////////////////////////////////////////////////////////////

// phaser utility

function create(){
  let top = (100*(1 - game.default.gameWidth/opt.screen.w)/2).toString()+'%'
  let left = (100*(1 - game.default.gameHeight/opt.screen.h)/2).toString()+'%'
  $('#game').css({top: top, left: left})

  app.game.add.sprite(0, 0, 'background')
  //app.game.time.events.loop(Phaser.Timer.SECOND, game.updateCounter, this)

  game.textGroup = app.game.add.group()
  game.text = app.game.add.text(0,0, '', {font: '26px Arial', fill:'#ffffff', align: 'left'})
  game.text.fixedToCamera = true
  game.text.cameraOffset.setTo(21, game.default.gameHeight/2 - 44/game.default.scale)
  game.textGroup.add(game.text)

  socket.emit('init', it => {
	  personal['deck'].push(new Card('cardback', 'deck', true, true))
    opponent['deck'].push(new Card('cardback', 'deck', false, true))
    game.fixPos('foe', 'deck')
    game.pageInit()
  })
}

function preload(){
  for(let type in opt.file.preload){
    for(let elem in opt.file.preload[type])
      app.game.load[type](elem, opt.file.preload[type][elem])
  }
}

function render(){}
function update(){}

//////////////////////////////////////////////////////////////////////////////////////

// socket server

socket.on('buildLIFE', it => {
  var life = JSON.parse(it)

  for(let i in life){
    personal['life'].push(new Card(life[i].name, 'life', true, true))
    personal['life'][i].changeInputFunction()
  }
  game.fixPos('self', 'life')
})

socket.on('foeBuiltLife', it => {
  for(let i = 0; i < 6; i++){
    opponent['life'].push(new Card('cardback', 'life', false, true))
  }
  game.fixPos('foe', 'life')
})

socket.on('foeDrawCard', it => {
  opponent['hand'].push(new Card('unknown', 'hand', false, true))
  game.fixPos('foe', 'hand')

  if(it.deckStatus === "empty"){
    opponent['deck'][0].face.kill()
  }
})

socket.on('foePlayHand', it => {
  opponent['hand'][0].face.destroy()
  opponent['hand'].pop() //-! only when no animation
  opponent['battle'].push(new Card(it.cardName, 'battle', false, false))
  game.fixPos('foe', 'hand')
  game.fixPos('foe', 'battle')
})

socket.on('foePlayLife', it => {

})

socket.on('gameStart', it => game.text.setText(it.msg))

socket.on('interrupt', it => {
  alert(it.err)
  game.text.setText(' ')
  game.changePage({next: 'lobby'})
  game.cleanAllData()
})

socket.on('joinGame', it => {//
  game.text.setText(it.msg)
  game.changePage({next:'game'})
})

socket.on('turnStart', it => {
  game.text.setText(it.msg)
})

//////////////////////////////////////////////////////////////////////////////////////

// game initialization
const game = new Game()
const personal = new Player({deckY:110, handY:220, lifeY:110, battleY:330, graveY:220})
const opponent = new Player({deckY:758, handY:648, lifeY:758, battleY:538, graveY:648})

socket.emit('preload', it => {
   opt.file.preload = it
   app.game = new Phaser.Game(game.default.gameWidth, game.default.gameHeight, Phaser.Canvas, 'game', {preload: preload, create: create, update: update, render: render})
})



