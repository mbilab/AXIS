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
const Card = function (name, field, onClick, cover) {
  this.cover = cover
  this.face = app.game.add.sprite(game.default.gameWidth * (1 - 1/13), personal['deckYloc'], this.cover ? 'cardback' : name)
  this.face.inputEnabled = onClick
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

    default: break
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
    game.fixPos('personal', 'hand')

    if(it.deckStatus === "empty")
      personal['deck'][0].face.kill()
  })
}

Card.prototype.playHandCard = function(){
  socket.emit('playHandCard', {name: this.face.name}, it => {
    if(it.err) return game.text.setText(it.err)
    //!--

    let dstField = ''
    for(let i in personal['hand']){
      if(personal['hand'][i].face.name === this.face.name){
        game.text.setText(`${it.msg.split(/(?=[A-Z])/)[0]} ${this.face.name}`)
        switch(it.msg){
          case 'equipArtifact':
            dstField = 'battle'
            break

          case 'useNormalItem':
            dstField = 'grave'
            break

          case 'castInstantSpell':
            dstField = 'grave'
            break

          default: break
        }

        personal[dstField].push(personal['hand'][i])
        personal['hand'][i].face.destroy
        personal['hand'].splice(i,1)
	      personal[dstField][personal[dstField].length -1].field = dstField
        personal[dstField][personal[dstField].length -1].changeInputFunction()
        game.fixPos('personal', 'hand')
        game.fixPos('personal', dstField)

        break
      }
    }

    /*
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
    */
  })
}

//const Deck = function(type, name, cardList) { //type: deckList, ownList
const Deck = function(type, slot, name, cardList){
  this.slot = slot
  this.type = type
  this.name = name
  this.cardList = cardList
  this.page = 1


  if(this.type === "deckList"){
    this.index = name.split("_")[1]
    this.img = app.game.add.sprite((game.default.gameWidth-232)/2 + 84*(this.index-1), game.default.gameHeight/2, 'emptySlot')
    this.img.events.onInputDown.add(this.changeFunc, this)
    this.img.kill()

    this.text = app.game.add.text((game.default.gameWidth-232)/2 + 84*(this.index-1), game.default.gameHeight/2, ' ', {font: '20px Arial', fill:'#ffffff', align: 'left', stroke: '#000000', strokeThickness: 4})
    this.text.kill()

    this.newBtn = app.game.add.button((game.default.gameWidth-232)/2 + 84*(this.index-1), game.default.gameHeight/2 + 110, 'new', this.buildNewDeck, this)
    this.newBtn.kill()
  }
}

Deck.prototype.buildNewDeck = function(){
  // !--
  //socket.emit('buildNewDeck', {slot: this.index}, it => {
  socket.emit('buildNewDeck', {slot: this.slot}, it => {
    console.log(it.newDeck)
    //if(this.img.texture === 'emptySlot'){
      this.cardList = it.newDeck
      this.img.loadTexture('cardback')
      this.img.inputEnabled = true
      this.text.setText(`deck_${this.index}`)
    //}
    alert('you build a new deck')
  })
}

Deck.prototype.changeFunc = function(){
  switch(game.currPage){
    case 'deckBuild':
      this.deckView()
      break

    case 'matchSearch':
      this.deckChoose()
      break

    default:
      alert(game.currPage)
      break
  }
}

Deck.prototype.deckChoose = function(){
  //personal['deckName'] = this.name

  personal['currDeck'] = this.slot

}

Deck.prototype.deckView = function(){
  game.changePage({next: 'deckView'})
  this.deckChoose()
  //game.changeTexture()
  game.shiftTexture({next: 'in'})
}

const Game = function (){
  this.counter = 0
  this.currPage = 'start'
  this.default = {
    buttonHeight: 43,
    buttonWidth: 88,
    cardHeight: 91,
	  cardWidth: 64,
	  gameHeight: 700,
    gameWidth: 1366,
    scale: 768*(opt.screen.w/opt.screen.h)/1366
  }
  this.page = {
    start: [
      {type: 'btn', x: this.default.gameWidth/2 - 100, y: this.default.gameHeight*0.75, img: 'login', func: this.changePage, next: 'login'},
      {type: 'btn', x: this.default.gameWidth/2 + 12, y: this.default.gameHeight*0.75, img: 'signup', func: this.changePage, next: 'signup'}
    ],
    login: [
      {type: 'html', id: 'login'},
      {type: 'btn', x: 0, y: this.default.gameHeight - 43, img: 'back', func: this.changePage, next: 'start'}
    ],
    signup:[
      {type: 'html', id: 'signup'},
      {type: 'btn', x: 0, y: this.default.gameHeight - 43, img: 'back', func: this.changePage, next: 'start'}
    ],
    lobby: [
      {type: 'btn', x: 0, y: 0, img: 'decks', func: this.changePage, next: 'deckBuild'},
      {type: 'btn', x: 0, y: 43, img: 'battle', func: this.changePage, next: 'matchSearch'}
    ],
    deckBuild: [
      {type: 'btn', x: 0, y: this.default.gameHeight - 43, img: 'back', func: this.changePage, next: 'lobby'}
    ],
    deckView: [
      {type: 'btn', x: 0, y: this.default.gameHeight - 43, img: 'back', func: this.changePage, next: 'deckBuild'},
      {type: 'btn', x: this.default.gameWidth - 50, y: this.default.gameHeight/2, img: 'nextBtn', func: this.shiftTexture, next: 'next'},
      {type: 'btn', x: 5, y: this.default.gameHeight/2, img: 'prevBtn', func: this.shiftTexture, next: 'prev'}
    ],
    matchSearch: [
      {type: 'btn', x: this.default.gameWidth - 88, y: this.default.gameHeight - 43, img: 'search', func: this.search, next: 'loading'},
      {type: 'btn', x: 0, y: this.default.gameHeight - 43, img: 'back', func: this.changePage, next: 'lobby'}
    ],
    loading: [],
    game: [
      {type: 'btn', x: this.default.gameWidth - 121, y: this.default.gameHeight/2 - 44/this.default.scale, img: 'endTurn', func: this.endTurn, next: null},
      {type: 'btn', x: 0, y: this.default.gameHeight - 43, img: 'leave', func: this.leaveMatch, next: 'lobby'}
    ]
  }
  this.dst = ' '
  this.text = null
  this.textGroup = null
  this.viewPos = this.page.deckView.length // include 2 slider buttons and 1 back button
}



Game.prototype.shiftTexture = function(curr){
  let currDeck = personal['deckSlot'][personal['currDeck']]
  //let currDeck = personal['deckSlot'][`slot_${personal['deckName'].split("_")[1]}`]
  let nextBtn = this.page.deckView[1]
  let prevBtn = this.page.deckView[2]
  let startPos = (currDeck.page - 1)*10
  let cardList = currDeck.cardList.slice(startPos, startPos + 10)

  // set current texture page
  if(curr.next === 'next') currDeck.page += 1
  if(curr.next === 'prev') currDeck.page -= 1
  if(curr.next === 'in') currDeck.page = 1

  // show or hide shift button
  if(currDeck.page == 1)
    prevBtn.kill()
  else
    prevBtn.reset(prevBtn.x, prevBtn.y)

  if(currDeck.page == currDeck.cardList.length/10)
    nextBtn.kill()
  else
    nextBtn.reset(nextBtn.x, nextBtn.y)

  // change card texture
  for(let i = this.viewPos; i < this.viewPos + 10; i++){
    this.page.deckView[i].loadTexture(cardList[i - this.viewPos])
    this.page.deckView[i].describe.setText(cardList[i - this.viewPos])
  }
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
      else{
        if(oldPage[i].type === 'html'){
          this.htmlSwap(oldPage[i], 'bottom')
        }
        else
          oldPage[i].kill()
      }
    }
  }

  this.currPage = btn.next

  if(newPage){
    for(let i in newPage){
      if(!Array.isArray(newPage[i])){
        if(newPage[i].type === 'html')
          this.htmlSwap(newPage[i], 'front')
        else
          newPage[i].reset(newPage[i].x, newPage[i].y)
      }
      else
        if(newPage[i] == personal['deck'] || newPage[i] == opponent['deck'])
          newPage[i][0].face.reset(newPage[i][0].face.x, newPage[i][0].face.y)
    }
  }

  //variable reset due to page change
  //personal['deckName'] = null
  personal['currDeck'] = null
}

Game.prototype.cleanAllData = function(){
  let field = ['hand', 'life', 'grave', 'battle']
  this.text.setText(' ')
  for(let i in field){
    personal[field[i]].splice(0,personal[field[i]].length)
    opponent[field[i]].splice(0,opponent[field[i]].length)
  }
}

//Game.prototype.deckSlotInit = function(deckList){
  // !--
Game.prototype.deckSlotInit = function(deckSlot){
  for(let slot in deckSlot){
    let deckName = deckSlot[slot].name
    personal['deckSlot'][slot] = new Deck('deckList', slot, deckName, [])
    if(deckSlot[slot].cardList.length){
      personal['deckSlot'][slot].text.setText(deckName)
      personal['deckSlot'][slot].img.loadTexture('cardback')
      personal['deckSlot'][slot].img.inputEnabled = true
      personal['deckSlot'][slot].cardList = deckSlot[slot].cardList
    }
    this.page.matchSearch.push(personal['deckSlot'][slot].img)
    this.page.matchSearch.push(personal['deckSlot'][slot].text)
    this.page.deckBuild.push(personal['deckSlot'][slot].img)
    this.page.deckBuild.push(personal['deckSlot'][slot].text)
    this.page.deckBuild.push(personal['deckSlot'][slot].newBtn)
  }

  /*
  let deckName = Object.keys(deckList)

  for(let slot = 1; slot <= personal.deckSlot.size; slot ++) {
    personal['deckSlot'][`slot_${slot}`] = new Deck('deckList', `deck_${slot}`, [])
    if(deckName.length >= slot && deckList[deckName[slot-1]].length){
      personal['deckSlot'][`slot_${slot}`].name = deckName[slot-1]
      personal['deckSlot'][`slot_${slot}`].text.setText(deckName[slot-1])
      personal['deckSlot'][`slot_${slot}`].img.loadTexture('cardback')
      personal['deckSlot'][`slot_${slot}`].img.inputEnabled = true
      personal['deckSlot'][`slot_${slot}`].cardList = deckList[deckName[slot-1]]
    }
    this.page.matchSearch.push(personal['deckSlot'][`slot_${slot}`].img)
    this.page.matchSearch.push(personal['deckSlot'][`slot_${slot}`].text)
    this.page.deckBuild.push(personal['deckSlot'][`slot_${slot}`].img)
    this.page.deckBuild.push(personal['deckSlot'][`slot_${slot}`].text)
    this.page.deckBuild.push(personal['deckSlot'][`slot_${slot}`].newBtn)
  }
  */
}

Game.prototype.endTurn = function(){
  socket.emit('finish', it => {this.text.setText(it.msg)})
}

Game.prototype.fixPos = function(player, field){
  // !-- refactor
  if(player === 'personal'){
    for(let i in personal[field]){
      if(field === 'battle'||'hand'||'life')
        personal[field][i].face.reset((this.default.gameWidth/2) - this.default.cardWidth*1.25 - this.default.cardWidth/2 - (this.default.cardWidth*3/5)*(personal[field].length - 1) + (this.default.cardWidth*6/5)*i, personal[`${field}Yloc`])
      if(field === 'grave')
        personal[field][i].face.reset(this.default.gameWidth*(1 - 1/13), personal[`${field}Yloc`])
    }
  }
  else{
    if(field !== 'deck'){
      for(let i in opponent[field]){
        if(field === 'battle'||'hand'||'life')
          opponent[field][i].face.reset((this.default.gameWidth/2) - this.default.cardWidth*1.25 - this.default.cardWidth/2 - (this.default.cardWidth*3/5)*(opponent[field].length - 1) + (this.default.cardWidth*6/5)*i, opponent[`${field}Yloc`])
        if(field === 'grave')
          opponent[field][i].face.reset(this.default.gameWidth*(1 - 1/13), opponent[`${field}Yloc`])
      }
    }
    else{
		  opponent[field][0].face.reset(this.default.gameWidth*(1 - 1/13), opponent[`${field}Yloc`])
    }
  }
}

Game.prototype.htmlSwap = function(elem, place){
  let i = (place === 'front')? 1: -1
  if(elem.id) $(`#${elem.id}`).css('zIndex', i)
}

Game.prototype.leaveMatch = function(){
  socket.emit('leaveMatch')
  this.changePage({next:'lobby'})
  this.cleanAllData()
}

Game.prototype.login = function(){
  if(!$('#logAcc').val()) return alert('please enter your account')
  if(!$('#logPswd').val()) return alert('please enter your password')
//!--
  socket.emit('login',  {acc: $('#logAcc').val(), passwd: $('#logPswd').val()}, it => {
    if(it.err){
      alert(it.err)
      $('#logAcc, #logPswd').val('')
      return
    }

    //game.deckSlotInit(it.deckList)
    game.deckSlotInit(it.deckSlot)
    console.log(it.deckSlot)
    this.changePage({next: 'lobby'})
  })
}

Game.prototype.pageInit = function(){

  // add general items
  for (let pageName in this.page) {
    for (let [index, elem] of this.page[pageName].entries()) {
      if(elem.type!=='html' && this.page[pageName].length){
        this.page[pageName].splice(index, 1, app.game.add.button(elem.x, elem.y, elem.img, elem.func, this))
        this.page[pageName][index].next = elem.next
        this.page[pageName][index].kill()
      }
    }
  }

  // add cards in deck view page
  for(let i = 0; i < 2; i++){
    for(let j = 0; j < 5; j++){
      let x = (this.default.gameWidth - (5*this.default.cardWidth + 4*84))/2 + (this.default.cardWidth + 84)*j
      let y = this.default.gameHeight/2 - 40 - this.default.cardHeight + (80 + this.default.cardHeight)*i
      let card = app.game.add.sprite(x, y, 'emptySlot')
      card.describe = app.game.add.text(x + this.default.cardWidth, y, "aaa",  { font: "20px Arial", fill: '#000000', backgroundColor: 'rgba(255,255,255,0.5)'})
      card.inputEnabled = true
      card.events.onInputOver.add(function(){card.describe.reset(card.describe.x, card.describe.y)}, this)
      card.events.onInputOut.add(function(){card.describe.kill()}, this)
      card.kill()
      card.describe.kill()
      this.page.deckView.push(card)
    }
  }

  // add cards in game page
  for(let i of ['deck', 'hand', 'life', 'grave', 'battle']){
    this.page.game.push(personal[i])
    this.page.game.push(opponent[i])
    if(i === 'deck'){
      personal['deck'][0].face.kill()
      opponent['deck'][0].face.kill()
    }
  }

  this.changePage({next: 'start'})
}

Game.prototype.search = function(){
  //socket.emit('search', {deckName: personal['deckName']}, it => {
  socket.emit('search', {currDeck: personal['currDeck']}, it => {
    if(it.err) return alert(it.err)

    this.text.setText(it.msg)
    if(it.msg !== 'searching for match...')
      this.changePage({next:'game'})
    else
      this.changePage({next:'loading'})
  })
}

Game.prototype.signup = function(){
  if(!$('#sgnAcc').val()) return alert('please enter your account')
  if(!$('#sgnPswd').val()) return alert('please enter your password')
  if(!$('#sgnRepswd').val()) return alert('please enter your password again')
  if($('#sgnPswd').val() !== $('#sgnRepswd').val()) return alert('passwords are different')

  socket.emit('signup',  {acc: $('#sgnAcc').val(), passwd: $('#sgnPswd').val()}, it => {
    if(it.err) {
      alert(it.err)
      $('#sgnAcc, #sgnPswd, #sgnRepswd').val('')
      return
    }
    this.changePage({next: 'start'})
  })
}

const Player = function(obj){
  for (let field of ['deckY', 'handY', 'lifeY', 'battleY', 'graveY'])
    this[`${field}loc`] = game.default.gameHeight - obj[field] / game.default.scale

  this.deck = []
  //this.deckName = ''
  this.currDeck = ''
  this.deckSlot = {}
  this.deckSlot.size = 3
  this.ownList = {}
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
    game.fixPos('opponent', 'deck')
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
  game.fixPos('personal', 'life')
})

socket.on('foeBuiltLife', it => {
  for(let i = 0; i < 6; i++){
    opponent['life'].push(new Card('cardback', 'life', false, true))
  }
  game.fixPos('opponent', 'life')
})

socket.on('foeDrawCard', it => {
  opponent['hand'].push(new Card('unknown', 'hand', false, true))
  game.fixPos('opponent', 'hand')

  if(it.deckStatus === "empty"){
    opponent['deck'][0].face.kill()
  }
})

socket.on('foePlayHand', it => {

  switch(it.msg){
    case 'equipArtifact':
      dstField = 'battle'
      break

    case 'useNormalItem':
      dstField = 'grave'
      break

    case 'castInstantSpell':
      dstField = 'grave'
      break

    default: break
  }

  opponent['hand'][0].face.destroy()
  opponent['hand'].shift()
  opponent[dstField].push(new Card(it.cardName, dstField, false, false))
	game.fixPos('opponent', 'hand')
  game.fixPos('opponent', dstField)

  /*
  opponent['hand'][0].face.destroy()
  opponent['hand'].shift() //-! only when no animation
  //opponent['hand'].splice(0,1)
  opponent['battle'].push(new Card(it.cardName, 'battle', false, false))
  game.fixPos('foe', 'hand')
  game.fixPos('foe', 'battle')
  */
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



