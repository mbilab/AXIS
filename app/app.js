const socket = io()

// global variables (default values)

// system define or belongs to system
const opt = {
  game: null,
  screen: {
    w: document.documentElement.clientWidth, //browser width
    h: document.documentElement.clientHeight, //browser height
  }
}

// self define
const app = {
  counter: 0,
  data: {},
  display: {
	  cardHeight: 91,
	  cardWidth: 64,
	  gameHeight: 700,
    gameWidth: 1366,
    scale: 768*(opt.screen.w/opt.screen.h)/1366
  }
}

// dynamic
const page = {
  currPage: ['login'],
  login: [
    {x: app.display.gameWidth - 83, y: app.display.gameHeight*0.75, img: 'login', func: login, next: 'lobby'}
  ],
  signup: [],
  lobby: [
    {x: 0, y: 0, img: 'decks', func: changePage, next: 'deckBuild'},
    {x: 0, y: 43, img: 'battle', func: changePage, next: 'matchSearch'}
  ],
  deckBuild: [
    {x: 0, y: app.display.gameHeight - 43, img: 'back', func: changePage, next: 'lobby'}
  ],
  matchSearch: [
    {x: app.display.gameWidth - 88, y: app.display.gameHeight - 43, img: 'search', func: search, next: 'loading'},
    {x: 0, y: app.display.gameHeight - 43, img: 'back', func: changePage, next: 'lobby'}
  ],
  loading: [],
  game: [
    {x: app.display.gameWidth - 121, y: app.display.gameHeight/2 - 44/app.display.scale, img: 'endTurn', func: endTurn, next: null},
    {x: 0, y: app.display.gameHeight - 43, img: 'leave', func: leaveMatch, next: 'lobby'}
  ]
}

//////////////////////////////////////////////////////////////////////////////////////

// classes

const Card = function (name, field, faceInput, cover) {
  this.cover = cover
  this.face = opt.game.add.sprite(app.display.gameWidth * (1 - 1/13), personal['deckYloc'], this.cover ? 'cardback' : name)
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
  text.setText(`This is ${this.face.name}`);
  // change to => hover card for couple secs, and show the card's face sprite beside
}

Card.prototype.drawCard = function(){
	socket.emit('drawCard', it => {
    if(it.err) return text.setText(it.err)

    text.setText(`draw ${it.cardName}`)
    personal['hand'].push(new Card(it.cardName, 'hand', true, false))
    personal['hand'][personal['hand'].length - 1].changeInputFunction()
    fixPos("self", "hand")

    if(it.deckStatus === "empty")
      personal['deck'][0].face.kill()
  })
}

Card.prototype.playHandCard = function(){
  socket.emit('playHandCard', {name: this.face.name}, it => {
    if(it.err) return text.setText(it.err)

    text.setText(`play ${this.face.name}`)

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
    fixPos('self', 'hand')
    fixPos('self', 'battle')
  })
}

const player = function(obj){
  for (let field of ['deckY', 'handY', 'lifeY', 'battleY', 'graveY'])
    this[`${field}loc`] = app.display.gameHeight - obj[field] / app.display.scale

  this.deck = []
  this.deck.name = ''
  this.deckList = {}
  this.hand = []
  this.life = []
  this.battle = []
  this.grave = []
}

//////////////////////////////////////////////////////////////////////////////////////

// utility

function changePage(currPage){
  let oldPage = page[page['currPage'][0]]
  let newPage = page[currPage.next]

  console.log(currPage.next)

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

  page['currPage'][0] = currPage.next

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

function cleanAllData(){
  let field = ['hand', 'life', 'grave', 'battle']
  text.setText(' ')

  for(let i in field){
    personal[field[i]].splice(0,personal[field[i]].length)
    opponent[field[i]].splice(0,opponent[field[i]].length)
  }
}

function create(){
  let top = (100*(1 - app.display.gameWidth/opt.screen.w)/2).toString()+'%'
  let left = (100*(1 - app.display.gameHeight/opt.screen.h)/2).toString()+'%'
  $('#game').css({top: top, left: left})

  opt.game.add.sprite(0, 0, 'background')
  //game.scale.scaleMode = Phaser.ScaleManager.EXACT_FIT
  opt.game.time.events.loop(Phaser.Timer.SECOND, updateCounter, this)

  textGroup = opt.game.add.group()
  text = opt.game.add.text(0,0, '', {font: '26px Arial', fill:'#ffffff', align: 'left'})
  text.fixedToCamera = true
  text.cameraOffset.setTo(21, app.display.gameHeight/2 - 44/app.display.scale)
  textGroup.add(text)

  socket.emit('init', it => {
	  personal['deck'].push(new Card('cardback', 'deck', true, true))
    opponent['deck'].push(new Card('cardback', 'deck', false, true))
    fixPos('foe', 'deck')

    pageInit()
  })
}

function endTurn(){
  socket.emit('finish', it => {text.setText(it.msg)})
}

function fixPos(player, field){
  if(player === "self"){
    for(let i in personal[field]){
      personal[field][i].face.x = (app.display.gameWidth/2) - app.display.cardWidth*1.25 - app.display.cardWidth/2 - (app.display.cardWidth*3/5)*(personal[field].length - 1) + (app.display.cardWidth*6/5)*i
   	  personal[field][i].face.y = personal[`${field}Yloc`]
    }
  }
  else{
    if(field !== 'deck')
      for(let i in opponent[field]){
        opponent[field][i].face.x = (app.display.gameWidth/2) - app.display.cardWidth*1.25 - app.display.cardWidth/2 - (app.display.cardWidth*3/5)*(opponent[field].length - 1) + (app.display.cardWidth*6/5)*i
  	    opponent[field][i].face.y = opponent[`${field}Yloc`]
      }
    else{
		  opponent[field][0].face.x = app.display.gameWidth*(1 - 1/13)
      opponent[field][0].face.y = opponent[`${field}Yloc`]
    }
  }
}

function leaveMatch(){
  socket.emit('leaveMatch')
  changePage({next:'lobby'})
  cleanAllData()
}

function login(){
  if($('#account').val()){
    socket.emit('login',  {acc: $('#account').val(), passwd: $('#passwd').val()}, it => {
      if(it.err) {
        alert(it.err)
        $('#account, #passwd').val('')
        return
      }

      self['deckList'] = it.deckList
      $('#login').remove()
      changePage({next: 'lobby'})
    })
  }
  else
    alert('please enter your account')
}

function pageInit(){
  for (let pages in page) {
    for (let [index, elem] of page[pages].entries()) {
      if(pages !== 'currPage' && page[pages].length){
        page[pages].splice(index, 1, opt.game.add.button(elem.x, elem.y, elem.img, elem.func, this))
        page[pages][index].next = elem.next
      }
    }
  }

  for(let currPage of Object.keys(page)){
    if(currPage !== 'currPage')
      for(let elem of page[currPage])
        elem.kill()
  }

  for(let i of ['deck', 'hand', 'life', 'grave', 'battle']){
    page.game.push(personal[i])
    page.game.push(opponent[i])
    if(i === 'deck'){
      personal['deck'][0].face.kill()
      opponent['deck'][0].face.kill()
    }
  }
}

function preload(){
 // console.log(app.data)
  for(let type in app.data){
    for(let elem in app.data[type])
      //console.log(type, elem, app.data[type][elem] )
      opt.game.load[type](elem, app.data[type][elem])
  }
/*
  game.load.image('background', 'assets/image/yellow.png')
	game.load.image('endTurn', 'assets/image/button.jpg')
	game.load.image('attack', 'assets/image/atk.png')
  game.load.image('search', 'assets/image/search.png')
  game.load.image('battle', 'assets/image/battle.png')
  game.load.image('decks', 'assets/image/deck.png')
  game.load.image('back', 'assets/image/back.png')
  game.load.image('login', 'assets/image/login.png')
  game.load.image('leave', 'assets/image/leave.png')

	game.load.spritesheet('cardback', 'assets/image/CARDBACK.jpg')
	game.load.spritesheet('cardface', 'assets/image/cardface.png')
  game.load.spritesheet('transparent', 'assets/image/transparent.png')

	game.load.spritesheet('katana', 'assets/image/katana.jpg')
	game.load.spritesheet('claymore', 'assets/image/claymore.jpg')
  game.load.spritesheet('judge', 'assets/image/judge.jpg')
  game.load.spritesheet('hawkeye', 'assets/image/hawkeye.jpg')
  game.load.spritesheet('aquarius', 'assets/image/aquarius.jpg')
  game.load.spritesheet('vesper', 'assets/image/vesper.jpg')
  game.load.spritesheet('doom', 'assets/image/doom.jpg')
  game.load.spritesheet('aria', 'assets/image/aria.jpg')
  game.load.spritesheet('shadow', 'assets/image/shadow.jpg')
  game.load.spritesheet('muse', 'assets/image/muse.jpg')
*/
}

function render(){
}

function search(){
  socket.emit('search', it => {
    text.setText(it.msg)
    if(it.msg !== 'searching for match...')
      changePage({next:'game'})
    else
      changePage({next:'loading'})
  })
}

function update(){
  //Phaser.ScaleManager.RESIZE
}

function updateCounter(){
  app.counter++
}

function updDeckList() {
  socket.emit('updDeckList', personal.deckList, it => {

  })
}

//////////////////////////////////////////////////////////////////////////////////////

// socket server

socket.on('buildLIFE', it => {
  var life = JSON.parse(it)

  for(let i in life){
    personal['life'].push(new Card(life[i].name, 'life', true, true))
    personal['life'][i].changeInputFunction()
  }
  fixPos("self", "life")
})

socket.on('foeBuiltLife', it => {
  for(let i = 0; i < 6; i++){
    opponent['life'].push(new Card('cardback', 'life', false, true))
  }
  fixPos("foe", "life")
})

socket.on('foeDrawCard', it => {
  opponent['hand'].push(new Card('unknown', 'hand', false, true))
  fixPos("foe", "hand")

  if(it.deckStatus === "empty"){
    opponent['deck'][0].face.kill()
  }
})

socket.on('foePlayHand', it => {
  opponent['hand'][0].face.destroy()
  opponent['hand'].pop() //-! only when no animation
  opponent['battle'].push(new Card(it.cardName, 'battle', false, false))
  fixPos('foe', 'hand')
  fixPos('foe', 'battle')
})

socket.on('foePlayLife', it => {

})

socket.on('gameStart', it => text.setText(it.msg))

socket.on('interrupt', it => {
  alert(it.err)
  text.setText(' ')
  changePage({next: 'lobby'})
  cleanAllData()
})

socket.on('joinGame', it => {//
  text.setText(it.msg)
  changePage({next:'game'})
})

socket.on('turnStart', it => text.setText(it.msg))

//////////////////////////////////////////////////////////////////////////////////////

// game initialization
const personal = new player({deckY:110, handY:220, lifeY:110, battleY:330, graveY:220})
const opponent = new player({deckY:758, handY:648, lifeY:758, battleY:538, graveY:648})

//var game

socket.emit('preload', it => {
   //console.log(it)
   app.data = it
   opt.game = new Phaser.Game(app.display.gameWidth, app.display.gameHeight, Phaser.Canvas, 'game', {preload: preload, create: create, update: update, render:render})
})



