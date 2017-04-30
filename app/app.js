const w = document.documentElement.clientWidth
const h = document.documentElement.clientHeight
const screenW = screen.width
const screenH = screen.height
const ratio = w/h

const app = {
  counter: 0
}

const display = {
	gameWidth: 2600,
	gameHeight: 2600/ratio,
	cardWidth: 120,
	cardHeight: 165,
  scale: 1400*ratio/2600
}

const self = {
  deckYloc: display.gameHeight - 200/display.scale,
  handYloc: display.gameHeight - 400/display.scale,
  lifeYloc: display.gameHeight - 200/display.scale,
  battleYloc: display.gameHeight - 600/display.scale,
  graveYloc: display.gameHeight - 400/display.scale,

  deck: [],
  hand: [],
  life: [],
  battle: [],
  grave: []
}

const foe = {
  deckYloc: display.gameHeight - 1368/display.scale,
  handYloc: display.gameHeight - 1168/display.scale,
  lifeYloc: display.gameHeight - 1368/display.scale,
  battleYloc: display.gameHeight - 968/display.scale,
  graveYloc: display.gameHeight - 1168/display.scale,

  deck: [],
  hand: [],
  life: [],
  battle: [],
  grave: []
}

const msg = {
	field: "",
	name: ""
}

const game = new Phaser.Game(2600, 2600/ratio, Phaser.AUTO, 'game', {preload: preload, create: create, update: update, render:render})

function preload(){
	game.load.image('background', 'assets/images/yellow.png')
	game.load.image('endTurn', 'assets/images/button.png')
	game.load.image('attack', 'assets/images/atk.png')

	game.load.spritesheet('cardback', 'assets/images/CARDBACK.jpg')
	game.load.spritesheet('cardface', 'assets/images/cardface.png')
  game.load.spritesheet('transparent', 'assets/images/transparent.png')

	game.load.spritesheet('katana', 'assets/images/katana.jpg')
	game.load.spritesheet('claymore', 'assets/images/claymore.jpg')
  game.load.spritesheet('judge', 'assets/images/judge.jpg')
  game.load.spritesheet('hawkeye', 'assets/images/hawkeye.jpg')
  game.load.spritesheet('aquarius', 'assets/images/aquarius.jpg')
  game.load.spritesheet('vesper', 'assets/images/vesper.jpg')
  game.load.spritesheet('doom', 'assets/images/doom.jpg')
  game.load.spritesheet('aria', 'assets/images/aria.jpg')
  game.load.spritesheet('shadow', 'assets/images/shadow.jpg')
  game.load.spritesheet('muse', 'assets/images/muse.jpg')
}

// server

var socket = io()
const roomID = location.search.replace(/\?roomID=/, '')

socket.on('buildLIFE', it => {
  var life = JSON.parse(it)

  for(var i = 0; i < life.length; i++){
    self['life'].push(new Card(life[i].name, 'life', true, true))//
    self['life'][i].changeInputFunction()//
  }
  fixPos("self", "life")
})

socket.on('foeBuiltLife', it => {
  for(var i = 0; i < 6; i++){
    foe['life'].push(new Card('cardback', 'life', false, true))//
  }
  fixPos("foe", "life")
})


socket.on('gameStart', it => {
  self['deck'][0].face.inputEnabled = true
  text.setText(it.msg)
})

socket.on('turnStart', it => {
  text.setText(it.msg)
})

socket.on('foeDrawCard', it => {

   foe['hand'].push(new Card('unknown', 'hand', false, true))//
   fixPos("foe", "hand")

   if(it.deckStatus === "empty"){
     foe['deck'][0].face.destroy()
     foe['deck'].splice(0,1)
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

var Card = function (name, field, faceInput, cover){

  this.field = field
  this.cover = cover

  if(this.cover == false)
    this.face = game.add.sprite(display.gameWidth - 200, display.gameHeight - 200/display.scale, name)
 else
    this.face = game.add.sprite(display.gameWidth - 200, display.gameHeight - 200/display.scale, 'cardback')

  this.face.inputEnabled = faceInput
  if(this.field === "deck"){
    this.face.events.onInputDown.add(this.drawCard, this)
  }

  this.face.name = name
}

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
    this.face.events.onInputDown,add(this.drawCard, this)
  }

}

Card.prototype.drawCard = function(){
	socket.emit('drawCard', roomID, it => {
    if(!it.msg){
      text.setText('draw '+it.cardName)
      self['hand'].push(new Card(it.cardName, 'hand', true, false))
      self['hand'][self['hand'].length - 1].changeInputFunction()
      fixPos("self", "hand")

      if(it.deckStatus === "empty"){
        self['deck'][0].face.destroy()
        self['deck'].splice(0,1)
      }
    }
    else
      text.setText(it.msg)
  })
}

Card.prototype.playHandCard = function(){
  msg.field = this.field
	msg.name = this.face.name

  socket.emit('playHandCard', roomID, JSON.stringify(msg), it => {
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

    socket.emit('playLifeCard', (roomID, JSON.stringify(msg), cb) => {
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
        self[field][i].face.x = (display.gameWidth/2) - 80 - display.cardWidth/2 - (display.cardWidth*3/5)*(self[field].length - 1) + (display.cardWidth*6/5)*i
			  self[field][i].face.y = self[field+'Yloc']
      }
    }
    else{
      if(field !== 'deck')
        for(var i = 0; i < foe[field].length; i++){
          foe[field][i].face.x = (display.gameWidth/2) - 80 - display.cardWidth/2 - (display.cardWidth*3/5)*(foe[field].length - 1) + (display.cardWidth*6/5)*i
			    foe[field][i].face.y = foe[field+'Yloc']
        }
      else{
        foe[field][0].face.x = display.gameWidth - 200
			  foe[field][0].face.y = foe[field+'Yloc']
      }
    }
}

function create(){
  game.physics.startSystem(Phaser.Physics.ARCADE)
	game.add.tileSprite(0, 0, display.gameWidth, display.gameHeight, 'background')
	game.world.setBounds(0, 0, display.gameWidth, display.gameHeight)
  game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL
  game.time.events.loop(Phaser.Timer.SECOND, updateCounter, this)

  text = game.add.text(0,0, 'matching opponent...', {font: ' 50px Arial', fill:'#ffffff', align: 'left'})
  text.fixedToCamera = true
  text.cameraOffset.setTo(40, display.gameHeight/2 - 80/display.scale)

  socket.emit('login', {roomID: roomID}, it => {
    //alert(it.msg)

    // create DECK
	  self['deck'].push(new Card('cardback', 'deck', false, true))//

    // create foe DECK
	  foe['deck'].push(new Card('cardback', 'deck', false, true))//
    fixPos("foe", "deck")

    var button1 = game.add.button(display.gameWidth - 230, display.gameHeight/2 - 80/display.scale, 'endTurn', endTurn, this)
  })

}

function update(){
  //Phaser.ScaleManager.RESIZE
}

function render(){
}

