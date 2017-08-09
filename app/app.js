const socket = io()

// global variables (default values)

const opt = {
  //file: {}, //-! if function preload() could be changed, this might be removed
  screen: {
    //-! rename to height
    height: document.documentElement.clientHeight, // browser height
    //-! rename to width
    width: document.documentElement.clientWidth // browser width
  }
}

//-! if only one key (game) in `app` would be used in the game logics, then the variable `app` could represent the app.game

const app = {
  game: null
}

//const app = {}

//////////////////////////////////////////////////////////////////////////////////////

// classes

const Card = function (name, field, onClick, cover) {
  //-! need to discuss the variable names

  this.cover = cover

  //-! need to refine, `app` => `app` and put the `game.default` values to `opt` (opt.game_default or others)
  this.face = app.game.add.sprite(game.default.game_width * (1 - 1/13), personal['deckYloc'], this.cover ? 'cardback' : name)

  this.face.inputEnabled = onClick
  this.face.name = name
  this.field = field

  this.stamp = false

  //-! comment needed
  if ('deck' === this.field)
    this.face.events.onInputDown.add(this.drawCard, this)
}

Card.prototype.activateCard = function () {
  socket.emit('activateCard', {name: this.face.name}, it => {
    if(it.err) return (it.err !== 'atk phase')?game.text.setText(it.err):(null)

    // charge artifact effect (0 ap)
    // trigger artifact effect (0 ap)
    // active trigger spell effect (0 ap)
    // normal item effect (place on artifact) (0 ap)
    // remove permanent spell from field (1 ap)

  })
}

Card.prototype.changeInputFunction = function () {
  //-! what is input function ?

  this.face.events.onInputDown.removeAll()

  switch (this.field) {
    case 'battle':
      if ('artifact' === this.card_type)
        this.face.events.onInputDown.add(this.activateCard, this)
      break

    case 'deck':
      this.face.events.onInputDown.add(this.drawCard, this)
      break

    case 'hand':
      if ('vanish' !== this.face.name)
        this.face.events.onInputDown.add(this.playHandCard, this)
      break

    case 'life':
      if (this.cover) {
        this.face.events.onInputDown.add(this.checkCard, this)
        this.face.loadTexture('cardback')
      }
      else {
        this.face.loadTexture(this.face.name)
        if ('vanish' !== this.face.name)
          this.face.events.onInputDown.add(this.playLifeCard, this)
      }
      break

    default: break
  }
}

Card.prototype.checkCard = function() {
  //-! what is check card ?
  game.text.setText(`This is ${this.face.name}`);
  // change to => hover card for couple secs, and show the card's face sprite beside
}

Card.prototype.drawCard = function() {
	socket.emit('drawCard', it => {
    if (it.err) return (it.err !== 'atk phase')?game.text.setText(it.err):(null)

    game.text.setText(`draw ${it.card_name}`)
    personal.hand.push(new Card(it.card_name, 'hand', true, false))
    personal.hand[personal.hand.length - 1].changeInputFunction()
    game.fixPos('personal', 'hand')

    //-! change deck_status to boolean or numeric values, if there are only two status , then change `deck_status` to `deck_empty` (true / false) or others

    if (it.deck_empty == true)
      personal.deck[0].face.kill()
  })
}

Card.prototype.playHandCard = function () {
  this.stamp = true
  socket.emit('playHandCard', { name: this.face.name}, it => {
    if (it.err) return (it.err !== 'atk phase')? game.text.setText(it.err):(this.stamp = (this.stamp == false)? true: false)

    //!--
    for (let [i, card] of personal.hand.entries()) {
      if (card.face.name === this.face.name && card.stamp == true){
        let dst_field = game.actionExecute(it.action)
        let target = (it.owner === 'opponent')?(opponent):(personal)
        game.text.setText(`${it.action.split(/(?=[A-Z])/)[0]} ${this.face.name}`)

        card.inputEnabled = (target == opponent)?(false):(true)
        target[dst_field].push(card)
        personal.hand.splice(i,1)
	      target[dst_field][target[dst_field].length -1].field = dst_field
        target[dst_field][target[dst_field].length -1].changeInputFunction()
        game.fixPos('personal', 'hand')
        game.fixPos(it.owner, dst_field)
        this.stamp = false

        break
      }
    }
  })
}

const Deck = function (type, slot, name, card_list) {
  //-! need to discuss the variable names

  this.slot = slot
  this.type = type
  this.name = name
  this.card_list = card_list
  this.page = 1

  if ('deckList' === this.type) {
    this.index = slot.split("_")[1]
    this.img = app.game.add.sprite((game.default.game_width-232)/2 + 84*(this.index-1), game.default.game_height/2, 'emptySlot')
    this.img.events.onInputDown.add(this.changeFunc, this)
    this.img.kill()

    this.text = app.game.add.text((game.default.game_width-232)/2 + 84*(this.index-1), game.default.game_height/2, ' ', {font: '20px Arial', fill:'#ffffff', align: 'left', stroke: '#000000', strokeThickness: 4})
    this.text.kill()

    this.new_btn = app.game.add.button((game.default.game_width-232)/2 + 84*(this.index-1), game.default.game_height/2 + 110, 'new', this.buildNewDeck, this)
    this.new_btn.kill()
  }
}

Deck.prototype.buildNewDeck = function () {
  // !--
  socket.emit('buildNewDeck', { slot: this.slot }, it => {
    console.log(it.newDeck)
    this.card_list = it.newDeck
    this.img.loadTexture('cardback')
    this.img.inputEnabled = true
    this.text.setText(`deck_${this.index}`)
    alert('you build a new deck')
  })
}

Deck.prototype.changeFunc = function (){
  //-! what is change fucntion ?

  switch (game.curr_page) {
    case 'deck_build':
      this.viewDeck()
      break

    case 'match_search':
      this.chooseDeck()
      break

    default:
      alert(game.curr_page)
      break
  }
}

Deck.prototype.chooseDeck = function () {
  if (personal.curr_deck !== this.slot) {
    personal.curr_deck = this.slot
    game.text.setText(`${this.name}`)
  }
}

Deck.prototype.viewDeck = function () {
  game.changePage({ next: 'deck_view' })
  this.chooseDeck()
  game.shiftTexture({ next: 'in' })
}

const Game = function () {
  this.counter = 0
  this.curr_page = 'start'

  //-! put these values to opt

  this.default = {
    button_height: 43,
    button_width: 88,
    card_height: 91,
	  card_width: 64,
	  game_height: 700,
    game_width: 1366,
    scale: 768*(opt.screen.width/opt.screen.height)/1366
  }

  //-! need to discuss the logics below
  /*
  this.page = {
    start: [
      {type: 'btn', x: this.default.game_width/2 - 100, y: this.default.game_height*0.75, img: 'login', func: this.changePage, next: 'login'},
      {type: 'btn', x: this.default.game_width/2 + 12, y: this.default.game_height*0.75, img: 'signup', func: this.changePage, next: 'sign_up'}
    ],
    login: [
      {type: 'html', id: 'login'},
      {type: 'btn', x: 0, y: this.default.game_height - 43, img: 'back', func: this.changePage, next: 'start'}
    ],
    sign_up:[
      {type: 'html', id: 'signup'},
      {type: 'btn', x: 0, y: this.default.game_height - 43, img: 'back', func: this.changePage, next: 'start'}
    ],
    lobby: [
      {type: 'btn', x: 0, y: 0, img: 'decks', func: this.changePage, next: 'deck_build'},
      {type: 'btn', x: 0, y: 43, img: 'battle', func: this.changePage, next: 'match_search'}
    ],
    deck_build: [
      {type: 'btn', x: 0, y: this.default.game_height - 43, img: 'back', func: this.changePage, next: 'lobby'}
    ],
    deck_view: [
      {type: 'btn', x: 0, y: this.default.game_height - 43, img: 'back', func: this.changePage, next: 'deck_build'},
      {type: 'btn', x: this.default.game_width - 50, y: this.default.game_height/2, img: 'nextBtn', func: this.shiftTexture, next: 'next'},
      {type: 'btn', x: 5, y: this.default.game_height/2, img: 'prevBtn', func: this.shiftTexture, next: 'prev'}
    ],
    match_search: [
      {type: 'btn', x: this.default.game_width - 88, y: this.default.game_height - 43, img: 'search', func: this.search, next: 'loading'},
      {type: 'btn', x: 0, y: this.default.game_height - 43, img: 'back', func: this.changePage, next: 'lobby'}
    ],
    loading: [],
    game: [
      {type: 'btn', x: this.default.game_width - 121, y: this.default.game_height/2 - 44/this.default.scale, img: 'endTurn', func: this.endTurn, next: null},
      {type: 'btn', x: 0, y: this.default.game_height - 43, img: 'leave', func: this.leaveMatch, next: 'lobby'}
    ]
  }
  */
  this.page = {
    start: {
      login: {type: 'btn', x: this.default.game_width/2 - 100, y: this.default.game_height*0.75, img: 'login', func: this.changePage, next: 'login'},
      sign_up: {type: 'btn', x: this.default.game_width/2 + 12, y: this.default.game_height*0.75, img: 'signup', func: this.changePage, next: 'sign_up'}
    },
    login: {
      login: {type: 'html', id: 'login'},
      back: {type: 'btn', x: 0, y: this.default.game_height - 43, img: 'back', func: this.changePage, next: 'start'}
    },
    sign_up:{
      sign_up: {type: 'html', id: 'signup'},
      back: {type: 'btn', x: 0, y: this.default.game_height - 43, img: 'back', func: this.changePage, next: 'start'}
    },
    lobby: {
      deck_build: {type: 'btn', x: 0, y: 0, img: 'decks', func: this.changePage, next: 'deck_build'},
      match_search: {type: 'btn', x: 0, y: 43, img: 'battle', func: this.changePage, next: 'match_search'}
    },
    deck_build: {
      back: {type: 'btn', x: 0, y: this.default.game_height - 43, img: 'back', func: this.changePage, next: 'lobby'}
    },
    deck_view: {
      back: {type: 'btn', x: 0, y: this.default.game_height - 43, img: 'back', func: this.changePage, next: 'deck_build'},
      next: {type: 'btn', x: this.default.game_width - 50, y: this.default.game_height/2, img: 'nextBtn', func: this.shiftTexture, next: 'next'},
      prev: {type: 'btn', x: 5, y: this.default.game_height/2, img: 'prevBtn', func: this.shiftTexture, next: 'prev'}
    },
    match_search: {
      search: {type: 'btn', x: this.default.game_width - 88, y: this.default.game_height - 43, img: 'search', func: this.search, next: 'loading'},
      back: {type: 'btn', x: 0, y: this.default.game_height - 43, img: 'back', func: this.changePage, next: 'lobby'}
    },
    loading: {},
    game: {
      end_turn: {type: 'btn', x: this.default.game_width - 121, y: this.default.game_height/2 - 44/this.default.scale, img: 'endTurn', func: this.endTurn, next: null},
      leave: {type: 'btn', x: 0, y: this.default.game_height - 43, img: 'leave', func: this.leaveMatch, next: 'lobby'}
    }
  }
  this.text = null
  this.text_group = null
  this.view_pos = this.page.deck_view.length // include 2 slider buttons and 1 back button
}

Game.prototype.actionExecute = function (actionType) {
  //-! what is action exeucte ?

  let dst_field = ''
  switch (actionType) {
    case 'equipArtifact':
      dst_field = 'battle'
      break

    case 'useNormalItem':
      dst_field = 'grave'
      break

    case 'castInstantSpell':
      dst_field = 'grave'
      break

    default: break
  }
  return dst_field
}

// !--
// start an attack, get into attack phase
Game.prototype.attack = function () {
  socket.emit('attack', it => {
    if(it.err) return (it.err !== 'atk phase')?game.text.setText(it.err):(null)
    game.text.setText(it.msg)
  })
}

Game.prototype.concealOrTracking = function (action) {
  // action >> conceal / tracking
  // conceal use for counter tracking
  // tracking use for counter conceal and dodge

  this.cardChoose()
  socket.emit('concealOrTracking', {action: action, card_pick: personal.card_pick}, it => {
    if(it.err) return personal.card_pick = []

  })
}

Game.prototype.cardChoose = function () {
  for(let [i, card] of personal.hand.entries()){
    if(card.stamp == true){
      personal.card_pick.push(i)
      card.stamp = false
    }
  }
}

Game.prototype.battleFieldArrange = function (card_list, turn_end) { // turn_end >> you end this turn or you're gonna start a new turn
  let player = { personal: personal, opponent: opponent}
  for(let target in player){
    for(let [index, card] of player[target].battle.entries()){
      let owner = card_list[target][card.face.name]

      if(owner != null){
        if(owner === 'personal')
          card.inputEnabled = (turn_end == true)? true: false
        else
          card.inputEnabled = (turn_end == true)? false: true

        // destroy face?

        player[owner].grave.push(card)
        player[target].battle.splice(index, 1)
        this.fixPos(target, 'hand')
        this.fixPos(owner, 'grave')
      }
    }
  }
}

Game.prototype.changePage = function (btn) {
  /*
  let old_page = this.page[this.curr_page]
  let new_page = this.page[btn.next]

  if (old_page) {
    for (let i in old_page) {
      if (Array.isArray(old_page[i])) {
        if (old_page[i] === personal.deck || old_page[i] === opponent.deck)
          old_page[i][0].face.kill()
        else
          for (let j in old_page[i])
            old_page[i][j].face.destroy()
      }
      else {
        if ('html' === old_page[i].type)
          this.htmlSwap(old_page[i], 'bottom')
        else
          old_page[i].kill()
      }
    }
  }

  this.curr_page = btn.next

  if (new_page) {
    for (let i in new_page) {
      if (!Array.isArray(new_page[i])) {
        if ('html' === new_page[i].type)
          this.htmlSwap(new_page[i], 'front')
        else
          new_page[i].reset(new_page[i].x, new_page[i].y)
      }
      else
        if (new_page[i] === personal.deck || new_page[i] === opponent.deck)
          new_page[i][0].face.reset(new_page[i][0].face.x, new_page[i][0].face.y)
    }
  }
  */
  let old_page = this.page[this.curr_page]
  let new_page = this.page[btn.next]

  if (old_page) {
    console.log(old_page)
    for (let i in old_page) {
      console.log(i)
      if (Array.isArray(old_page[i])) {
        if (old_page[i] === personal.deck || old_page[i] === opponent.deck)
          old_page[i][0].face.kill()
        else
          for (let j in old_page[i])
            old_page[i][j].face.destroy()
      }
      else {
        if ('html' === old_page[i].type)
          this.htmlSwap(old_page[i], 'bottom')
        else
          old_page[i].kill()
      }
    }
  }

  this.curr_page = btn.next

  if (new_page) {
    for (let i in new_page) {
      if (!Array.isArray(new_page[i])) {
        if ('html' === new_page[i].type)
          this.htmlSwap(new_page[i], 'front')
        else
          new_page[i].reset(new_page[i].x, new_page[i].y)
      }
      else
        if (new_page[i] === personal.deck || new_page[i] === opponent.deck)
          new_page[i][0].face.reset(new_page[i][0].face.x, new_page[i][0].face.y)
    }
  }

  // variable reset due to page change
  personal.curr_deck = null
  game.text.setText('') //-! change ' ' to '' ?
}

Game.prototype.cleanAllData = function () {
  let field = ['hand', 'life', 'grave', 'battle']
  this.text.setText(' ')
  for (let i in field) {
    personal[field[i]].splice(0, personal[field[i]].length)
    opponent[field[i]].splice(0, opponent[field[i]].length)
  }
}

Game.prototype.deckSlotInit = function (deck_slot) {
  for (let slot in deck_slot) {
    let deck_name = deck_slot[slot].name
    personal.deck_slot[slot] = new Deck('deckList', slot, deck_name, [])
    if (deck_slot[slot].card_list.length) {
      personal.deck_slot[slot].text.setText(deck_name)
      personal.deck_slot[slot].img.loadTexture('cardback')
      personal.deck_slot[slot].img.inputEnabled = true
      personal.deck_slot[slot].card_list = deck_slot[slot].card_list
    }
    /*
    this.page.match_search.push(personal.deck_slot[slot].img)
    this.page.match_search.push(personal.deck_slot[slot].text)
    this.page.deck_build.push(personal.deck_slot[slot].img)
    this.page.deck_build.push(personal.deck_slot[slot].text)
    this.page.deck_build.push(personal.deck_slot[slot].new_btn)
    */
    this.page.match_search[`${slot}_img`] = personal.deck_slot[slot].img
    this.page.match_search[`${slot}_text`] = personal.deck_slot[slot].text
    this.page.deck_build[`${slot}_img`] = personal.deck_slot[slot].img
    this.page.deck_build[`${slot}_text`] = personal.deck_slot[slot].text
    this.page.deck_build[`${slot}_btn`] = personal.deck_slot[slot].new_btn
  }
}

Game.prototype.effectTrigger = function () {

}

Game.prototype.endTurn = function () {
  socket.emit('finish', it => {
    this.battleFieldArrange(it.card_list, true)
    this.text.setText(it.msg)
  })
}

//-! try this way
//Game.prototype.endTurn = () => socket.emit('finish', it => this.text.setText(it.msg))

Game.prototype.fixPos = function (player, field) {
  // !-- refactor
  if (player === 'personal') {
    for (let i in personal[field]) {
      if (field === 'battle'||'hand'||'life')
        personal[field][i].face.reset((this.default.game_width/2) - this.default.card_width*1.25 - this.default.card_width/2 - (this.default.card_width*3/5)*(personal[field].length - 1) + (this.default.card_width*6/5)*i, personal[`${field}Yloc`])
      if (field === 'grave')
        personal[field][i].face.reset(this.default.game_width*(1 - 1/13), personal[`${field}Yloc`])
    }
  }
  else {
    if (field !== 'deck') {
      for (let i in opponent[field]) {
        if (field === 'battle'||'hand'||'life')
          opponent[field][i].face.reset((this.default.game_width/2) - this.default.card_width*1.25 - this.default.card_width/2 - (this.default.card_width*3/5)*(opponent[field].length - 1) + (this.default.card_width*6/5)*i, opponent[`${field}Yloc`])
        if (field === 'grave')
          opponent[field][i].face.reset(this.default.game_width*(1 - 1/13), opponent[`${field}Yloc`])
      }
    }
    else {
		  opponent[field][0].face.reset(this.default.game_width*(1 - 1/13), opponent[`${field}Yloc`])
    }
  }
}

Game.prototype.htmlSwap = function (elem, place) {
  let i = (place === 'front')? 1: -1
  if (elem.id) $(`#${elem.id}`).css('zIndex', i)
}

Game.prototype.leaveMatch = function () {
  socket.emit('leaveMatch')
  this.changePage({ next:'lobby' })
  this.cleanAllData()
}

Game.prototype.login = function () {
  if (!$('#logAcc').val()) return alert('please enter your account')
  if (!$('#logPswd').val()) return alert('please enter your password')
//!--
  socket.emit('login',  { acc: $('#logAcc').val(), passwd: $('#logPswd').val() }, it => {
    if (it.err) {
      alert(it.err)
      $('#logAcc, #logPswd').val('')
      return
    }

    game.deckSlotInit(it.deck_slot)
    //console.log(it.deck_slot)
    this.changePage({ next: 'lobby' })
  })
}

Game.prototype.pageInit = function () {
  /*
  // add general items
  for (let pageName in this.page) {
    for (let [index, elem] of this.page[pageName].entries()) {
      if (elem.type!=='html' && this.page[pageName].length) {
        this.page[pageName].splice(index, 1, app.game.add.button(elem.x, elem.y, elem.img, elem.func, this))
        this.page[pageName][index].next = elem.next
        this.page[pageName][index].kill()
      }
    }
  }

  // add cards in deck view page
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 5; j++) {
      let x = (this.default.game_width - (5*this.default.card_width + 4*84))/2 + (this.default.card_width + 84)*j
      let y = this.default.game_height/2 - 40 - this.default.card_height + (80 + this.default.card_height)*i
      let card = app.game.add.sprite(x, y, 'emptySlot')
      card.describe = app.game.add.text(x, y + this.default.card_height, "aaa",  { font: "20px Arial", fill: '#000000', backgroundColor: 'rgba(255,255,255,0.5)'})
      card.inputEnabled = true
      card.events.onInputOver.add(function(){card.describe.reset(card.describe.x, card.describe.y)}, this)
      card.events.onInputOut.add(function(){card.describe.kill()}, this)
      card.kill()
      card.describe.kill()
      this.page.deck_view.push(card)
    }
  }

  // add cards in game page
  for (let i of ['deck', 'hand', 'life', 'grave', 'battle']) {
    this.page.game.push(personal[i])
    this.page.game.push(opponent[i])
    if(i === 'deck') {
      personal['deck'][0].face.kill()
      opponent['deck'][0].face.kill()
    }
  }

  this.changePage({next: 'start'})
  */
  // add general items
  for (let page_name in this.page) {
    for (let elem_name in this.page[page_name]) {
      let elem = this.page[page_name][elem_name]
      if(elem != null){
        let next = elem.next
        if (elem.type!=='html') {
          this.page[page_name][elem_name] = app.game.add.button(elem.x, elem.y, elem.img, elem.func, this)
          this.page[page_name][elem_name].next = elem.next
          this.page[page_name][elem_name].kill()
        }
      }
    }
  }

  // add cards in deck view page
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 5; j++) {
      let x = (this.default.game_width - (5*this.default.card_width + 4*84))/2 + (this.default.card_width + 84)*j
      let y = this.default.game_height/2 - 40 - this.default.card_height + (80 + this.default.card_height)*i
      let card = app.game.add.sprite(x, y, 'emptySlot')
      card.describe = app.game.add.text(x, y + this.default.card_height, "aaa",  { font: "20px Arial", fill: '#000000', backgroundColor: 'rgba(255,255,255,0.5)'})
      card.inputEnabled = true
      card.events.onInputOver.add(function(){card.describe.reset(card.describe.x, card.describe.y)}, this)
      card.events.onInputOut.add(function(){card.describe.kill()}, this)
      card.kill()
      card.describe.kill()
      this.page.deck_view[`card${j+1+(i*5)}`] = card
    }
  }

  // add cards in game page
  for (let i of ['deck', 'hand', 'life', 'grave', 'battle']) {
    this.page.game[`personal_${i}`] = personal[i]
    this.page.game[`opponent_${i}`] = opponent[i]
    if(i === 'deck') {
      personal['deck'][0].face.kill()
      opponent['deck'][0].face.kill()
    }
  }

  console.log(this.page)

  this.changePage({next: 'start'})
}

Game.prototype.search = function () {
  socket.emit('search', {curr_deck: personal['curr_deck']}, it => {
    if(it.err) return game.text.setText(it.err)

    if(it.msg !== 'searching for match...')
      this.changePage({next:'game'})
    else
      this.changePage({next:'loading'})

    this.text.setText(it.msg)
  })
}

Game.prototype.shiftTexture = function (btn) {
  let curr_deck = personal['deck_slot'][personal['curr_deck']]
  //let next_btn = this.page.deck_view[1]
  //let prev_btn = this.page.deck_view[2]
  let next_btn = this.page.deck_view.next
  let prev_btn = this.page.deck_view.prev
  let start_pos = (curr_deck.page - 1)*10
  let card_list = curr_deck.card_list.slice(start_pos, start_pos + 10)

  // set current texture page
  if (btn.next === 'next') curr_deck.page += 1
  if (btn.next === 'prev') curr_deck.page -= 1
  if (btn.next === 'in') curr_deck.page = 1

  // show or hide shift button
  if (curr_deck.page == 1)
    prev_btn.kill()
  else
    prev_btn.reset(prev_btn.x, prev_btn.y)

  if (curr_deck.page == curr_deck.card_list.length/10)
    next_btn.kill()
  else
    next_btn.reset(next_btn.x, next_btn.y)

  // change card texture
  /*
  for (let i = this.view_pos; i < this.view_pos + 10; i++) {
    this.page.deck_view[i].loadTexture(card_list[i - this.view_pos])
    this.page.deck_view[i].describe.setText(card_list[i - this.view_pos])
  }
  */
  let i = 1
  for (let elem_name in this.page.deck_view){
    if(elem_name === `card${i}`){
      this.page.deck_view[elem_name].loadTexture(card_list[i - 1])
      this.page.deck_view[elem_name].describe.setText(card_list[i - 1])
      i++
    }
  }
}

Game.prototype.signup = function () {
  if (!$('#sgnAcc').val()) return alert('please enter your account')
  if (!$('#sgnPswd').val()) return alert('please enter your password')
  if (!$('#sgnRepswd').val()) return alert('please enter your password again')
  if ($('#sgnPswd').val() !== $('#sgnRepswd').val()) return alert('passwords are different')

  socket.emit('signup',  {acc: $('#sgnAcc').val(), passwd: $('#sgnPswd').val()}, it => {
    if (it.err) {
      alert(it.err)
      $('#sgnAcc, #sgnPswd, #sgnRepswd').val('')
      return
    }
    this.changePage({next: 'start'})
  })
}

const Player = function (obj) {
  for (let field of ['deckY', 'handY', 'lifeY', 'battleY', 'graveY'])
    this[`${field}loc`] = game.default.game_height - obj[field] / game.default.scale

  // attribute
  this.card_pick = []
  this.curr_deck = ''
  this.deck_slot = {}
  this.deck_slot.size = 3
  this.own_list = {}

  // game field
  this.altar = []
  this.battle = []
  this.deck = []
  this.grave = []
  this.hand = []
  this.life = []
}

//////////////////////////////////////////////////////////////////////////////////////

// socket server

socket.on('buildLIFE', it => {
  var life = JSON.parse(it)

  for (let i in life) {
    personal['life'].push(new Card(life[i].name, 'life', true, true))
    personal['life'][i].changeInputFunction()
  }
  game.fixPos('personal', 'life')
})

// !--
socket.on('foeAttack', cb => {
  // show conceal/give up button

})

socket.on('foeConceal', it => {
  // ..
})

socket.on('foeTracking', it => {
  // ..
})

socket.on('foeBuiltLife', it => {
  for (let i = 0; i < 6; i++) {
    opponent['life'].push(new Card('cardback', 'life', false, true))
  }
  game.fixPos('opponent', 'life')
})

socket.on('foeDrawCard', it => {
  opponent['hand'].push(new Card('unknown', 'hand', false, true))
  game.fixPos('opponent', 'hand')
  game.text.setText('foe drawcard')

  if(it.deck_empty == true){
    opponent['deck'][0].face.kill()
  }
})

socket.on('foePlayHand', it => {
  let dst_field = game.actionExecute(it.action)
  let target = (it.owner === 'opponent')?(personal):(opponent)
  let owner = (it.owner === 'opponent')?('personal'):('opponent')

  opponent['hand'][0].face.destroy()
  opponent['hand'].shift()
  target[dst_field].push(new Card(it.card_name, dst_field, (target == opponent)?(true):(false), false))
  game.text.setText(`foe ${it.action.split(/(?=[A-Z])/)[0]} ${it.card_name}`)
  game.fixPos('opponent', 'hand')
  game.fixPos(owner, dst_field)
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
  game.battleFieldArrange(it.card_list, true)
  game.text.setText(it.msg)
})

//////////////////////////////////////////////////////////////////////////////////////

// game initialization
const game = new Game()
const personal = new Player({deckY:110, handY:220, lifeY:110, battleY:330, graveY:220})
const opponent = new Player({deckY:758, handY:648, lifeY:758, battleY:538, graveY:648})


socket.emit('preload', res => {
  //opt.file.preload = it
  //app.game = new Phaser.Game(game.default.game_width, game.default.game_height, Phaser.Canvas, 'game', {preload: preload, create: create, update: update, render: render})

  //-! try this way, and rename the param `it` to `res` or other


  app.game = new Phaser.Game(game.default.game_width, game.default.game_height, Phaser.Canvas, 'game', {
    create: () => {
      let top = (100*(1 - game.default.game_width/opt.screen.width)/2).toString()+'%'
      let left = (100*(1 - game.default.game_height/opt.screen.height)/2).toString()+'%'
      $('#game').css({top: top, left: left})

      app.game.add.sprite(0, 0, 'background')
      //app.time.events.loop(Phaser.Timer.SECOND, game.updateCounter, this)

      game.text_group = app.game.add.group()
      game.text = app.game.add.text(0,0, '', {font: '26px Arial', fill:'#ffffff', align: 'left'})
      game.text.fixedToCamera = true
      game.text.cameraOffset.setTo(21, game.default.game_height/2 - 44/game.default.scale)
      game.text_group.add(game.text)

      socket.emit('init', it => {
	      personal['deck'].push(new Card('cardback', 'deck', true, true))
        opponent['deck'].push(new Card('cardback', 'deck', false, true))
        game.fixPos('opponent', 'deck')
        game.pageInit()
      })

    },
    preload: () => {
      for (let type in res)
        for (let elem in res[type])
          app.game.load[type](elem, res[type][elem])
    },
    render: () => {},
    update: () => {}
  })

})
