const w = document.documentElement.clientWidth
const h = document.documentElement.clientHeight
const screenW = screen.width
const screenH = screen.height
const ratio = w/h

const app = {
  counter: 0
}

const display = {
  /*
  gameWidth: 2600,
	gameHeight: 2600/ratio,
  cardWidth: 120,
	cardHeight: 165,
  scale: 1400*ratio/2600
  */

  gameWidth: w,
	gameHeight: h,
	cardWidth: 64,
	cardHeight: 91,
  scale: 768*ratio/1366

}

const player = function(d, h, l, b, g){

  this.deckYloc = display.gameHeight - d/display.scale
  this.handYloc = display.gameHeight - h/display.scale
  this.lifeYloc = display.gameHeight - l/display.scale
  this.battleYloc = display.gameHeight - b/display.scale
  this.graveYloc = display.gameHeight - g/display.scale

  this.deck = []
  this.deck.name = ''
  this.hand = []
  this.life = []
  this.battle = []
  this.grave = []
}

//const self = new player(200, 400, 200, 600, 400)
//const foe = new player(1368, 1168, 1368, 968, 1168)
const self = new player(110, 220, 110, 330, 220)
const foe = new player(758, 648, 758, 538, 648)

var Card = function (name, field, faceInput, cover){

  this.field = field
  this.cover = cover

  if(this.cover == false)
    //this.face = game.add.sprite(display.gameWidth - 200, display.gameHeight - 200/display.scale, name)
    this.face = game.add.sprite(display.gameWidth*(1 - 1/13), self['deckYloc'], name)
  else
    //this.face = game.add.sprite(display.gameWidth - 200, display.gameHeight - 200/display.scale, 'cardback')
    this.face = game.add.sprite(display.gameWidth*(1 - 1/13), self['deckYloc'], 'cardback')


  this.face.inputEnabled = faceInput
  if(this.field === "deck"){
    this.face.events.onInputDown.add(this.drawCard, this)
  }

  this.face.name = name
}

// e.g. pos = [{x:0, y:0}, {x:10, y:20}]
const page = {
  currPage: "login",
  login: {elem:[], pos:[]},
  signup: {elem:[], pos:[]},
  lobby: {elem: [], pos: []},
  deckBuild: {elem:[], pos:[]},
  matchSearch: {elem:[], pos:[]},
  loading: {next: 'game', elem:[], pos:[]},
  game: {elem: [], pos: []}
}

const msg = {
	field: "",
	name: ""
}

//const game = new Phaser.Game(2600, 2600/ratio, Phaser.HEADLESS, 'game', {preload: preload, create: create, update: update, render:render})
const game = new Phaser.Game(display.gameWidth, display.gameHeight, Phaser.Canvas, 'game', {preload: preload, create: create, update: update, render:render})

function preload(){
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
}

// server
var socket = io()
const roomID = location.search.replace(/\?roomID=/, '')

socket.on('buildLIFE', it => {
  var life = JSON.parse(it)

  for(var i = 0; i < life.length; i++){
    self['life'].push(new Card(life[i].name, 'life', true, true))
    self['life'][i].changeInputFunction()
  }
  fixPos("self", "life")
})

socket.on('foeBuiltLife', it => {
  for(var i = 0; i < 6; i++){
    foe['life'].push(new Card('cardback', 'life', false, true))
  }
  fixPos("foe", "life")
})


socket.on('joinGame', it => {//
  text.setText(it.msg)
  changePage(page.loading)
})

socket.on('gameStart', it => {//
  text.setText(it.msg)
})

socket.on('turnStart', it => {
  text.setText(it.msg)
})

socket.on('foeDrawCard', it => {
  foe['hand'].push(new Card('unknown', 'hand', false, true))
  fixPos("foe", "hand")

  if(it.deckStatus === "empty"){
    foe['deck'][0].face.kill()
  }
})

socket.on('foePlayHand', it => {
  foe['hand'][0].face.destroy()
  foe['hand'].splice(0,1)
  foe['battle'].push(new Card(it.cardName, 'battle', false, false))
  fixPos('foe', 'hand')
  fixPos('foe', 'battle')
})

socket.on('foePlayLife', it => {

})

socket.on('interrupt', it => {
  alert(it.msg)
  text.setText(' ')
  changePage(backBtn)
  cleanAllData()
})

Card.prototype.changeInputFunction = function(){

  this.face.events.onInputDown.removeAll()

  if("hand" === this.field){
    if("vanish" !== this.face.name){
      this.face.events.onInputDown.add(this.playHandCard, this)
    }
  }

  if("life" === this.field && this.cover == true){
    this.face.events.onInputDown.add(this.checkCard, this)
    this.face.loadTexture('cardback')
  }
  else{
    this.face.loadTexture(this.face.name)
    if("vanish" !== this.face.name){
      this.face.events.onInputDown.add(this.playLifeCard, this)
    }
  }

  if("battle" === this.field){
    if("artifact" === this.cardType)
      this.face.events.onInputDown.add(this.activateCard, this)
  }

  if("deck" === this.field){
    this.face.events.onInputDown.add(this.drawCard, this)
  }

}

Card.prototype.drawCard = function(){
	socket.emit('drawCard', it => {
    if(!it.msg){
      text.setText('draw '+it.cardName)
      self['hand'].push(new Card(it.cardName, 'hand', true, false))
      self['hand'][self['hand'].length - 1].changeInputFunction()
      fixPos("self", "hand")

      if(it.deckStatus === "empty"){
        self['deck'][0].face.kill()
      }
    }
    else
      text.setText(it.msg)
  })
}

Card.prototype.playHandCard = function(){
  msg.field = this.field
	msg.name = this.face.name

  socket.emit('playHandCard', JSON.stringify(msg), it => {
    if(it.msg === 'playCard'){
	    text.setText('play '+msg.name)

      for(var i = 0; i < self['hand'].length; i++){
	      if(self['hand'][i].face.name === msg.name){
	        self['battle'].push(self['hand'][i])
	        self['hand'][i].face.destroy
          self['hand'].splice(i,1)
	        break
        }
	    }
	    self['battle'][self['battle'].length -1].field = 'battle'
      self['battle'][self['battle'].length -1].changeInputFunction()
      fixPos('self', 'hand')
      fixPos('self', 'battle')
    }
    else
      text.setText(it.msg)
  })
}

Card.prototype.playLifeCard = function(){
  msg.field = this.field
  msg.name = this.face.name
  /*
  if(self['hand'].length > 0){
    text.setText('choose 1 hand card')
    var sprite = game.add.sprite(0, 0, 'transparent')
    var endTime = app.counter + 41
    var x1 = self['hand'][0].face.x,
        x2 = x1 + self['hand'].length*display.cardWidth + (self['hand'].length - 1)*display.cardWidth/5,
        y1 = self['hand'][0].face.y,
        y2 = y1 + display.cardHeight,
        xloc = game.input.mousePointer.x,
        yloc = game.input.mousePointer.y
    sprite.scale.setTo(display.gameWidth/sprite.width, display.gameHeight/sprite.height)
    while(app.counter <= endTime){
      if(!msg.hand){
        if(xloc >= x1 && xloc <= x2 && yloc >= y1 && yloc <= y2){
          for(var i = 0; i < self['hand'].length; i++){
            if((xloc > x1 + 6*display.cardWidth*i/5) && (xloc < x1 + display.cardWidth + 6*display.cardWidth*i/5)){
              msg.hand = self['hand'][i].face.name
              break
            }
          }
        }
        else
          text.setText('not here')
      }
      else
        break
    }
    if(!msg.hand)
      msg.hand = self['hand'][Math.floor(Math.random()*(self['hand'].length - 1))]
    socket.emit('playLifeCard', (JSON.stringify(msg), cb) => {
      if(it.msg === 'playCard'){
      }
      else
        text.setText(it.msg)
    })
  }
  else{
    text.setText('not enough hand card')
  }
  */
}

Card.prototype.activateCard = function(){
	msg.field = this.field
	msg.name = this.face.name
	console.log(JSON.stringify(msg))
	this.changeInputFunction()
}

Card.prototype.checkCard = function(){
  text.setText('This is '+this.face.name);
  // change to => hover card for couple secs, and show the card's face sprite beside
}

function updateCounter(){
  app.counter++
}

function endTurn(){
  socket.emit('finish', roomID, it => {text.setText(it.msg)})
}

function fixPos(player, field){
  if(player === "self"){
    for(var i = 0; i < self[field].length; i++){
      //self[field][i].face.x = (display.gameWidth/2) - 80 - display.cardWidth/2 - (display.cardWidth*3/5)*(self[field].length - 1) + (display.cardWidth*6/5)*i
      self[field][i].face.x = (display.gameWidth/2) - display.cardWidth*1.25 - display.cardWidth/2 - (display.cardWidth*3/5)*(self[field].length - 1) + (display.cardWidth*6/5)*i
   	  self[field][i].face.y = self[field+'Yloc']
    }
  }
  else{
    if(field !== 'deck')
      for(var i = 0; i < foe[field].length; i++){
        //foe[field][i].face.x = (display.gameWidth/2) - 80 - display.cardWidth/2 - (display.cardWidth*3/5)*(foe[field].length - 1) + (display.cardWidth*6/5)*i
        foe[field][i].face.x = (display.gameWidth/2) - display.cardWidth*1.25 - display.cardWidth/2 - (display.cardWidth*3/5)*(foe[field].length - 1) + (display.cardWidth*6/5)*i
  	    foe[field][i].face.y = foe[field+'Yloc']
      }
    else{
      //foe[field][0].face.x = display.gameWidth - 200
		  foe[field][0].face.x = display.gameWidth*(1 - 1/13)
      foe[field][0].face.y = foe[field+'Yloc']
    }
  }
}

function cleanAllData(){
  var field = ['hand', 'life', 'grave', 'battle']
  text.setText(' ')

  for(var i = 0; i < field.length; i++){
    self[field[i]].splice(0,self[field[i]].length)
    foe[field[i]].splice(0,foe[field[i]].length)
  }
}

function login(){
  if($('#account').val()){
    socket.emit('login',  {acc: $('#account').val(), passwd: $('#passwd').val()}, it => {
      if(it.msg === 'success'){
        $('#login').remove()
        changePage(loginBtn)
      }
      else{
        alert(it.msg)
        $('#account').val('')
        $('#passwd').val('')
      }
    })
  }
  else
    alert('please enter your account')
}

function search(){
  socket.emit('search', it => {
    text.setText(it.msg)
    if(it.msg !== "searching for match...")
      changePage(page.loading)
    else
      changePage(searchBtn)
  })
}

function leaveMatch(){
  socket.emit('leaveMatch')
  changePage(backBtn)
  cleanAllData()
}

function pageInit(){
  var field = ['deck', 'hand', 'life', 'grave', 'battle']

  // login page
  page.login.elem.push(loginBtn)
  page.login.pos.push({x: loginBtn.x, y: loginBtn.y})
  loginBtn.next = 'lobby'
  loginBtn.kill()

  // the lobby
  page.lobby.elem.push(deckBtn)
  page.lobby.pos.push({x: deckBtn.x, y: deckBtn.y})
  deckBtn.next = 'deckBuild'
  deckBtn.kill()

  page.lobby.elem.push(matchBtn)
  page.lobby.pos.push({x: matchBtn.x, y: matchBtn.y})
  matchBtn.next = 'matchSearch'
  matchBtn.kill()

  // deck building page
  page.deckBuild.elem.push(backBtn)
  page.deckBuild.pos.push({x: backBtn.x, y: backBtn.y})
  backBtn.next = 'lobby'

  // match searching page
  page.matchSearch.elem.push(searchBtn)
  page.matchSearch.pos.push({x: searchBtn.x, y: searchBtn.y })
  searchBtn.next = 'loading'
  searchBtn.kill()

  page.matchSearch.elem.push(backBtn)
  page.matchSearch.pos.push({x: backBtn.x, y: backBtn.y})
  backBtn.kill()

  // loading page

  // game page
  page.game.elem.push(endBtn)
  page.game.pos.push({x: endBtn.x, y: endBtn.y})
  endBtn.kill()

  page.game.elem.push(leaveBtn)
  page.game.pos.push({x: leaveBtn.x, y: leaveBtn.y})
  leaveBtn.kill()

  for(var i = 0; i < field.length; i++){
    page.game.elem.push(self[field[i]])
    page.game.elem.push(foe[field[i]])
  }

  page.game.pos.push({x: self['deck'][0].face.x, y: self['deck'][0].face.y})
  page.game.pos.push({x: foe['deck'][0].face.x, y: foe['deck'][0].face.y})
  self['deck'][0].face.kill()
  foe['deck'][0].face.kill()

}

function changePage(currPage){
  var oldElem = page[page['currPage']]['elem']
  var newPage = page[currPage.next]

  // kill current page elements
  if(oldElem != []){
    for(var i = 0; i < oldElem.length; i++){
      // check elem[i] type, e.g deck
      if(Array.isArray(oldElem[i])){
        if(oldElem[i] == self['deck'] || oldElem[i] == foe['deck'])
          oldElem[i][0].face.kill()
        else
          for(var j = 0; j < oldElem[i].length; j++)
            oldElem[i][j].face.destroy()
      }
      else
        oldElem[i].kill()
    }
  }

  // change current page
  page['currPage'] = currPage.next

  // revive page elements on the page you move to
  if(newPage['elem'] != []){
    for(var i = 0; i < newPage['elem'].length; i++){
      if(!Array.isArray(newPage['elem'][i]))
        newPage['elem'][i].reset(newPage['pos'][i].x, newPage['pos'][i].y)
      else{
        if(newPage['pos'][i])
          newPage['elem'][i][0].face.reset(newPage['pos'][i].x, newPage['pos'][i].y)
      }
    }
  }

}

function create(){
  game.add.sprite(0, 0, 'background')
  game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL
  game.time.events.loop(Phaser.Timer.SECOND, updateCounter, this)


  textGroup = game.add.group()
  text = game.add.text(0,0, '', {font: '26px Arial', fill:'#ffffff', align: 'left'})
  text.fixedToCamera = true
  text.cameraOffset.setTo(21, display.gameHeight/2 - 44/display.scale)
  textGroup.add(text)

  socket.emit('init', it => {
    backBtn = game.add.button(0, display.gameHeight-43, 'back', changePage, this)
    loginBtn = game.add.button(display.gameWidth - 83, display.gameHeight*0.75,'login', login, this)
    deckBtn = game.add.button(0, 0, 'decks', changePage, this)
    matchBtn = game.add.button(0, 43, 'battle', changePage, this)
    searchBtn = game.add.button(0, 0, 'search', search, this)
    endBtn = game.add.button(display.gameWidth - 121, display.gameHeight/2 - 44/display.scale, 'endTurn', endTurn, this)
    leaveBtn = game.add.button(0, display.gameHeight - 43, 'leave', leaveMatch, this)

	  self['deck'].push(new Card('cardback', 'deck', true, true))
    foe['deck'].push(new Card('cardback', 'deck', false, true))
    fixPos('foe', 'deck')

    pageInit()
  })
}

function update(){
  //Phaser.ScaleManager.RESIZE
}

function render(){
}
