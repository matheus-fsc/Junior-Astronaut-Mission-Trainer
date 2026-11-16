// Generated with AI assistance (Claude). See README, "Use of AI tools".
// Screen-space layer on top of everything: resource bars, build bar, zoom controls, messages,
// and the morning / night / end panels that run the chapter rules (../regras.ts).
import Phaser from 'phaser';
import { tocarSfx } from '../sfx';
import { PRAZO_TEMPESTADE_MS, BATERIAS_TEMPESTADE_EXTREMA, danoDaTempestade } from './tempestadeSolar';
import { configuracoesAbertas, movimentoReduzido, video } from '../video';
import { LEVE } from './qualidade';
import { CAPITULOS } from '../capitulos';
import { calcularLayoutHud } from './layoutHud';
import { PreferenciaDicas } from './dicasControles';
import { Guia, AvisoEvento, AvisoExpedicao, SetaMissao } from './guia';
import { tutorialJaVisto } from './tutorial';
import type { DadosRadar } from './Radar';
import { fimDoDia, resultado, pontuacao, bateriasDoDia, naEnfermaria, DESCANSO, type Estado } from '../regras';
import { iniciarMundo3D, iniciarNave3D, iniciarMarte3D } from './irParaMarte';
import { suprimentoDoMundo } from '../engine/suprimentos';
import { DOSE_ALARME, type EventoDef } from '../engine/eventos';
import { CONDICOES, ESTUFA_OXIGENIO, type Condicao } from '../engine/condicoes';
import { sessao, fonte, dataBonita, U_INICIAL, COR, type Fase, type RelatorioDia } from './sessao';
import { apagarPartida } from '../salvamento';
import { alternarMudo } from '../audio';
import { ativarCacheGraphics } from './cacheGraphics';
import { letra, criarPilula, criarCapsulaRecursos, criarCapsulaRecursosMovel, criarBotaoPilula, criarIndicador, criarIndicadorCircular, criarIconeJogo, botaoVerde, criarDicasRecolhiveis, criarFaixaHud, criarTituloHud, criarBotaoZoom, moldura, discoAzul, CONTORNO } from '../tarefas/estilo';
import { resolverIcone, textoDoJogo, type IconeJogo } from '../dados/icones';
import { escalaInterface, dispositivoMovel } from '../mobile';
import { chaveSkin, SKIN_PADRAO } from '../dados/skins';
import sprite from '../dados/astronauta.json';
import { mostrarContadoresHud, mostrarHudNaSuperficie } from './visibilidadeHud';

type Botao = { texto: string; acao: () => void; principal?: boolean };
// A chat message: a custom equipment icon on the left and a short line.
type Parte = string | { texto: string; icone?: string; cor?: string; negrito?: boolean; tamanho?: number };
// Who is talking in a panel's chat: name over the first bubble, initials on the round avatar.
type Remetente = { nome: string; sigla: string; cor: number };
const CONTROLE: Remetente = { nome: 'Mission Control', sigla: 'MC', cor: 0x2563eb };
const COMPUTADOR: Remetente = { nome: 'Base computer', sigla: 'AI', cor: 0x7c3aed };
const NIVEIS = ['CALM', 'RISING', 'HIGH', 'EXTREME'];
const CORES_NIVEL = ['#4ade80', '#facc15', '#fb923c', '#f87171'];
// The on-map guide (guia.ts) plays on the first day on the Moon, once; ?tutorial plays it again even if already seen.
let tutorialExibido = false;
// NEW GAME always plays the guide again, even if it was seen before.
let tutorialNovoJogo = false;
const forcarTutorial = new URLSearchParams(location.search).has('tutorial');
// The first-run guide (guia.ts) runs once, on day 1 of the Moon. Its yellow arrows only exist while it runs.
const guiaVaiRodar = () => !tutorialExibido && sessao.mundo === 'lua' && sessao.estado.dia === 1 && (forcarTutorial || tutorialNovoJogo || !tutorialJaVisto());
// The rules of the chapter being played (the Moon, or Mars on the same engine).
const C_ = () => sessao.C;

export class Interface extends Phaser.Scene {
  private u = 1;
  private tituloHud?: ReturnType<typeof criarTituloHud>;   // none on phones (the round meters take the top)
  private recursos: { caixa: Phaser.GameObjects.Container; atualizar: (valor: number, cor?: number, aviso?: string) => void }[] = [];
  private eventoPerdido?: EventoDef;
  private capsula!: { caixa: Phaser.GameObjects.Container; atualizar: (valores: number[]) => void };
  private layout!: ReturnType<typeof calcularLayoutHud>;
  private objetivo!: Phaser.GameObjects.Container;
  private estrelaObjetivo!: ReturnType<typeof criarIconeJogo>;
  private textos: Record<string, Phaser.GameObjects.Text> = {};
  private painel: Phaser.GameObjects.GameObject[] = [];
  private acaoPrincipal?: () => void;
  private btPulo?: Phaser.GameObjects.Container;
  private aviso?: Phaser.GameObjects.Container;
  private alertaSolar!: Phaser.GameObjects.Container;
  private particulasSolares!: Phaser.GameObjects.Particles.ParticleEmitter;
  private iconeSolar!: Phaser.GameObjects.Image;
  private tituloSolar!: Phaser.GameObjects.Text;
  private anelSolar!: Phaser.GameObjects.Graphics;
  private anelSolarRaio = 0;
  private tempoSolar!: Phaser.GameObjects.Text;
  private contagemSolar!: Phaser.GameObjects.Text;
  private danoSolar!: Phaser.GameObjects.Text;
  private bateriasSolar: Phaser.GameObjects.Image[] = [];
  private readonly totalBateriasSolar = BATERIAS_TEMPESTADE_EXTREMA;
  private flashSolar!: Phaser.GameObjects.Graphics;
  private get desfechoPendente() { return sessao.desfechoPendente; }
  private set desfechoPendente(v: typeof sessao.desfechoPendente) { sessao.desfechoPendente=v; }
  private get danoTempestade() { return sessao.danoTempestade; }
  private set danoTempestade(v: number) { sessao.danoTempestade=v; }
  private get bateriasTempestade() { return sessao.bateriasTempestade; }
  private set bateriasTempestade(v: number) { sessao.bateriasTempestade=v; }
  private proximoAlarme = 0;
  private animacaoSolar = 0;
  private alertaSolarX = 0;
  private alertaSolarY = 0;
  private entregaPendente?: Phaser.Time.TimerEvent;
  private btFim!: Phaser.GameObjects.Container;
  private textoFim!: Phaser.GameObjects.Text;
  private iconeFim!: Phaser.GameObjects.Graphics;
  private dicas!: ReturnType<typeof criarDicasRecolhiveis>;
  private readonly preferenciaDicas = new PreferenciaDicas();
  private btMenu!: Phaser.GameObjects.Container;
  private timersChat: Phaser.Time.TimerEvent[] = [];
  private guia?: Guia;
  private avisoEvento?: AvisoEvento;
  private avisoExpedicao?: AvisoExpedicao;
  private setaMissao?: SetaMissao;
  private cortina!: Phaser.GameObjects.Rectangle;

  constructor() {
    super({ key: 'Interface' });   // started by Carregar
  }

  private texto(x: number, y: number, s: string, tamanho: number, cor = COR.texto, extra: Phaser.Types.GameObjects.Text.TextStyle = {}) {
    return this.add.text(x, y, s, fonte(tamanho * this.u, cor, extra));
  }

  private botao(x: number, y: number, s: string, acao: () => void, cor = '#334155', tamanho = 15) {
    return this.texto(x, y, s, tamanho, '#ffffff', { backgroundColor: cor, padding: { x: 12 * this.u, y: 7 * this.u }, fontStyle: 'bold' })
      .setInteractive({ useHandCursor: true }).on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, ev: Phaser.Types.Input.EventData) => { ev.stopPropagation(); acao(); });
  }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.u = escalaInterface(W, H);
    sessao.tela = { w: W, h: H };
    // The HUD is screen-space and almost all static: bake its shapes (cacheGraphics.ts).
    ativarCacheGraphics(this);
    this.textos = {};
    this.painel = [];
    // A restart (resize, new game) destroys every object: the notices are made again on the next update.
    this.avisoEvento = undefined;
    this.avisoExpedicao = undefined;
    this.setaMissao = undefined;
    if (sessao.fase !== 'fim') this.comemorou = false;   // a new game can celebrate again

    // Redraw every layer at the new size. The first resize event Phaser emits often repeats the
    // size create() already used; restarting for it would only throw away and rebuild everything.
    let telaAtual = { w: W, h: H };
    let espera: Phaser.Time.TimerEvent | undefined;
    const redimensionar = () => {
      const w = this.scale.width, h = this.scale.height;
      if (w === telaAtual.w && h === telaAtual.h) return;
      telaAtual = { w, h };
      espera?.remove();
      espera = this.time.delayedCall(150, () => {
        this.scene.get('Superficie').cameras.main.setSize(this.scale.width, this.scale.height);
        this.scene.get('Espaco').scene.restart();
        this.scene.restart();
      });
    };
    this.scale.on('resize', redimensionar);
    this.events.once('shutdown', () => this.scale.off('resize', redimensionar));

    this.criarHUD(W, H);
    this.btPulo=undefined;
    if(W<680 && !dispositivoMovel()) {
      this.btPulo=botaoVerde(this,W-64,H-112,'JUMP ↑',16,48,1,()=>{sessao.puloTouch=true;},
        {largura:104,pulsar:false,pararPropagacao:true});
      this.btPulo.setData('acao','jump');
    }
    this.criarAlertaSolar();
    this.criarParticulasSolares(W);

    const l = this.layout, fim = l.fimDia;
    // On touch screens this button keeps the desktop web size even when the rest of the HUD shrinks.
    const uFim = dispositivoMovel() ? Math.max(l.u, 1) : l.u;
    const fonteFim = Math.round(21 * uFim);
    this.btFim = botaoVerde(this, Math.round(fim.x + fim.w / 2), Math.round(fim.y + fim.h / 2), 'END DAY', fonteFim, fim.h, uFim,
      () => this.terminarDia(), { largura: fim.w, altura: fim.h, pulsar: false, pararPropagacao: true, animarHover: true, cor: 0x16e05f, corHover: 0x6ef5a0 });
    this.textoFim = this.btFim.getData('texto');
    // Draw the arrow as artwork, not an emoji glyph, so it is white on every device.
    this.iconeFim = this.add.graphics();
    this.textoFim.parentContainer.add(this.iconeFim);
    this.cortina = this.add.rectangle(0, 0, W, H, 0x05070f).setOrigin(0).setDepth(10_000_000).setAlpha(0);
    this.dicas = criarDicasRecolhiveis(this, l.dicasPainel, l.dicasAba, l.dicasFechadasX, l.u, l.dicasCompactas,
      this.preferenciaDicas.inicial(l.dicasCompactas), (recolhido) => this.preferenciaDicas.definir(recolhido));
    // On phones the right-column button replaces the drawer tab.
    if (dispositivoMovel() && W > H) { this.dicas.aba.setVisible(false); this.dicas.areaAba.disableInteractive(); }
    sessao.ouvir(this, 'controleUsado', (controle) => {
      if (this.preferenciaDicas.usar(controle)) this.dicas.definir(true);
    });

    // ----- input that must work at any zoom -----
    // Mouse wheel / touchpad: zoom around the cursor.
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) =>
      sessao.zoom(Phaser.Math.Clamp(dy, -150, 150) * 0.0025, { x: p.x, y: p.y }));
    // Two fingers: pinch to zoom around the point between them (one finger is handled by
    // Superficie: drag pans, tap walks).
    this.input.addPointer(1);
    let antes = 0;
    this.input.on('pointermove', () => {
      const a = this.input.pointer1, b = this.input.pointer2;
      if (!a.isDown || !b.isDown) { antes = 0; return; }
      const d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      // The ground under the fingers scales exactly with the fingers.
      if (antes) sessao.zoom(-Math.log(d / antes), { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      antes = d;
    });
    this.input.on('pointerup', () => { antes = 0; });
    const kb = this.input.keyboard!;
    kb.on('keydown-PLUS', () => sessao.zoom(-0.4));
    kb.on('keydown-NUMPAD_ADD', () => sessao.zoom(-0.4));
    kb.on('keydown-MINUS', () => sessao.zoom(0.4));
    kb.on('keydown-NUMPAD_SUBTRACT', () => sessao.zoom(0.4));
    kb.on('keydown-H', () => sessao.irPara(U_INICIAL));
    kb.on('keydown-M', () => { if (!configuracoesAbertas) alternarMudo(); });
    kb.on('keydown-ESC', () => this.abrirMenu());
    kb.on('keydown-ENTER', () => { if (!configuracoesAbertas) this.acaoPrincipal?.(); });

    sessao.ouvir(this, 'mensagem', (s, cor) => this.mensagem(s, cor));
    sessao.ouvir(this, 'premio', (p) => this.mostrarPremio(p));
    sessao.ouvir(this, 'desbloqueado', () => this.atualizar());
    sessao.ouvir(this, 'estado', () => this.atualizar());

    this.atualizar();
    if (sessao.partidaRestaurada) {
      sessao.partidaRestaurada=false;
      this.abrirTelaInicial();
    } else if (sessao.pousoChegada) {
      // Arriving on Mars: the lander comes down on the map first, then the first morning opens.
      sessao.pousoChegada = false;
      this.events.once('update', () => sessao.emitir('pousoFoguete', () => this.mostrarFase()));
    } else if (!this.scene.isActive('Radar') && !this.scene.isActive('Chegada')) this.mostrarFase();
    // A resize restart under the title screen, its countdown or the rocket flight leaves them be:
    // mostrarFase() would launch the title screen again on top of them (turning the phone brought
    // back the title, or drew it over the flight). They call irPara() when they end.
  }

  private abrirMenu() {
    if (sessao.emTarefa || sessao.abastecendoRover || sessao.transicao || configuracoesAbertas || this.scene.isActive('MenuJogo')) return;
    this.scene.launch('MenuJogo', { aoSairTitulo: () => this.abrirTelaInicial() });
    sessao.puloTouch=false;
  }

  // The keyboard button on the mobile HUD: the game instructions in a centered panel, all at once.
  private abrirInstrucoes() {
    if (sessao.emTarefa || sessao.abastecendoRover || sessao.transicao || configuracoesAbertas ||
        this.scene.isActive('MenuJogo') || this.scene.isActive('Radar') || this.scene.isActive('EditorBase') ||
        this.painel.length) return;
    this.abrirPainel('HOW TO PLAY', CONTROLE, [
      'MOVE: drag the joystick on the left. JUMP: tap JUMP. USE: tap USE next to a room, the Battery Bank or the rover.',
      'Pinch with two fingers to zoom the map.',
      'Pick up batteries, deliver them to the rooms, and press END DAY.',
    ], [{ texto: 'GOT IT  \u25b6', acao: () => this.fecharPainel(), principal: true }], { imediato: true });
  }

  abrirEditor(): boolean {
    if(sessao.emTarefa || sessao.abastecendoRover || sessao.editandoBase || sessao.partida || sessao.voo || sessao.transicao
      || configuracoesAbertas || this.scene.isActive('MenuJogo') || this.scene.isActive('EditorBase'))return false;
    if(sessao.mundo==='nave' || sessao.vista!=='chao' || (sessao.fase!=='dia' && sessao.fase!=='inicio'))return false;
    this.scene.launch('EditorBase');
    return true;
  }

  private abrirTelaInicial() {
    // Exploring another base: reloading brings the real game back from the save.
    if (sessao.explorando) { location.reload(); return; }
    const retomar = () => { this.atualizar(); if (sessao.fase !== 'inicio') this.mostrarFase(); };
    // A lost game is not continued: LAUNCH starts a new one.
    const perdeu = sessao.perdeu;
    const dados: DadosRadar = {
      continuar: sessao.fase !== 'inicio' && !perdeu,
      aoNovoJogo: () => this.novoJogo(),
      aoComecar: () => { if(perdeu)this.novoJogo(); else if(sessao.fase==='inicio')this.irPara('manha');else retomar(); },
      aoExplorar: mundo => this.explorarBase(mundo),
    };
    this.scene.launch('Radar', dados);
  }

  private novoJogo() {
    this.entregaPendente?.remove(); this.entregaPendente=undefined;
    this.guia?.terminar(); this.guia=undefined;
    tutorialExibido=false; tutorialNovoJogo=true;
    apagarPartida();
    iniciarMundo3D(this,'lua',0,0,[]);
  }

  private explorarBase(mundo: 'lua' | 'nave' | 'marte') {
    if (sessao.fase !== 'inicio') sessao.salvar();
    iniciarMundo3D(this,mundo,['lua','nave','marte'].indexOf(mundo),0,[],true);
  }

  update(_tempo: number, dt: number) {
    this.atualizarParticulasSolares();
    this.btPulo?.setVisible((sessao.fase==='dia'||sessao.fase==='inicio') && sessao.vista==='chao'
      && !sessao.rover?.dirigindo && !sessao.emTarefa && !sessao.editandoBase && !sessao.voo && !sessao.partida
      && !sessao.transicao && !configuracoesAbertas && !this.scene.isActive('Radar') && !this.scene.isActive('MenuJogo'));
    this.atualizarVisibilidadeContadores();
    this.cortina.setAlpha(sessao.transicao ? Math.sin(Math.PI * sessao.transicao.t) : 0);
    if (this.scene.isVisible() && !sessao.emTarefa && !configuracoesAbertas && !sessao.transicao && this.preferenciaDicas.passo(dt)) this.dicas.definir(true);
    this.atualizarTempestade(dt);
    this.textos.altitude.setText(sessao.vista === 'chao' ? 'Ground' : 'Space');
    // The guide starts on the first day on the Moon (after "Go!") and follows what the player does.
    if (!this.guia && sessao.fase === 'dia' && guiaVaiRodar()) {
      const sup = this.scene.get('Superficie') as unknown as { jaUsou(c: 'movimento' | 'pulo'): boolean };
      this.guia = new Guia(this, this.layout, (c) => sup.jaUsou(c), () => { tutorialExibido = true; tutorialNovoJogo = false; this.guia = undefined; });
    }
    const pausado = sessao.emTarefa || configuracoesAbertas || !!sessao.transicao || this.scene.isActive('MenuJogo');
    this.guia?.atualizar(dt, pausado);
    (this.setaMissao ??= new SetaMissao(this, this.layout)).atualizar(dt, pausado || !!this.guia);
    (this.avisoEvento ??= new AvisoEvento(this, this.layout)).atualizar(dt, pausado);
    (this.avisoExpedicao ??= new AvisoExpedicao(this, this.layout, () => !!this.guia)).atualizar(dt, pausado);
  }

  // Solar particles raining across the screen on storm days (as in the first, 2D version, Base.ts):
  // the stronger today's storm, the more of them (none on a calm, green day). Every world: the Moon, the ship and Mars.
  // Cheap on purpose: one small shared texture, a cap on live particles (lower in light mode), and the
  // emitter is only touched when today's rate changes; it rests while a task covers the map.
  private criarParticulasSolares(W: number) {
    if (!this.textures.exists('particula')) {
      this.make.graphics({}, false).fillStyle(0xffffff).fillCircle(3, 3, 3).generateTexture('particula', 6, 6).destroy();
    }
    const u = this.layout.u;
    this.ritmoParticulas = -1;
    this.particulasSolares = this.add.particles(0, 0, 'particula', {
      x: { min: -W * 0.3, max: W },
      y: -10,
      speedX: { min: 120, max: 220 },
      speedY: { min: 260, max: 420 },
      lifespan: 2600,
      scale: { min: 0.4 * u, max: 1.1 * u },
      alpha: { start: 0.9, end: 0 },
      tint: [0xfde047, 0xfb923c, 0xf87171],
      blendMode: 'ADD',
      maxAliveParticles: LEVE ? 60 : 160,
      emitting: false,
    }).setDepth(-1);   // over the map, under the HUD and the panels
  }

  private ritmoParticulas = -1;
  private atualizarParticulasSolares() {
    const emJogo = !sessao.explorando && !sessao.emTarefa && video.efeitos && !movimentoReduzido()
      && (sessao.fase === 'manha' || sessao.fase === 'dia' || sessao.fase === 'noite');
    // Today's real storm level (green CALM = none), not the forecast's top, which is above 0 almost every day.
    // High radiation brings them too: a radiation alarm going off (eventos.ts), or the crew's dose in the
    // red (health under 30, the HUD's own warning color).
    const alarme = sessao.evento?.def.efeito === 'radiacao' ? 2 : 0;
    const dose = sessao.estado.dose > 70 ? 1 : 0;
    const nivel = emJogo ? Math.max(0, Math.min(3, Math.max(sessao.dia?.nivel ?? 0, alarme, dose))) : 0;
    // ms between particles: fewer on light mode.
    const ritmo = [0, 140, 45, 12][nivel] * (LEVE && nivel ? 2 : 1);
    if (ritmo === this.ritmoParticulas) return;
    this.ritmoParticulas = ritmo;
    const e = this.particulasSolares;
    if (ritmo) { e.frequency = ritmo; if (!e.emitting) e.start(); }
    else e.stop();
  }

  private criarAlertaSolar() {
    const l = this.layout, px = (v: number) => Math.round(v * l.u);
    const w = Math.min(this.scale.width - 2 * l.margem, px(560)), h = px(116);
    const x = Math.round((this.scale.width - w) / 2), y = l.avisoY;
    const canto = px(16);
    // Translucent red rectangle: the map shows through it while the message stays readable.
    const fundo = this.add.graphics()
      .fillStyle(0x450a0a, 0.28).fillRoundedRect(px(2), px(6), w, h, canto)
      .fillStyle(0xc81e1e, 0.74).fillRoundedRect(0, 0, w, h, canto)
      .lineStyle(px(3), 0xfecaca, 0.85).strokeRoundedRect(px(1.5), px(1.5), w - px(3), h - px(3), Math.max(2, canto - px(1.5)));
    // Left: the yellow radiation medallion.
    const medalha = this.add.graphics().fillStyle(0x0b1a4a, 1).fillCircle(px(45), Math.round(h / 2), px(33));
    this.iconeSolar = criarIconeJogo(this, px(45), Math.round(h / 2), 'radiation', px(60));
    // Right: countdown ring.
    const rx = w - px(45), ry = Math.round(h / 2), raio = px(29);
    this.anelSolarRaio = raio - px(6);
    const anelFundo = this.add.graphics()
      .fillStyle(0x0b1a4a, 1).fillCircle(rx, ry, raio)
      .lineStyle(px(6), 0x6b1414, 1).strokeCircle(rx, ry, raio - px(6))
      .lineStyle(px(3), 0xffd93b, 1).strokeCircle(rx, ry, raio);
    this.anelSolar = this.add.graphics().setPosition(rx, ry);
    this.tempoSolar = this.add.text(rx, ry + px(1), '', letra(px(21), '#ffffff', {
      fontStyle: 'bold', stroke: '#0b1a4a', strokeThickness: px(3),
    })).setOrigin(0.5);
    // Title.
    this.tituloSolar = this.add.text(Math.round(w / 2), Math.round(h * 0.26), 'SOLAR STORM!', letra(px(23), '#ffd93b', {
      stroke: '#0b1a4a', strokeThickness: px(5), align: 'center',
    })).setOrigin(0.5);
    // This banner represents an extreme storm, independent of the chapter's forecast range.
    // Use the same requirement as the protection rule, including developer-triggered storms.
    const n = this.totalBateriasSolar;
    const rowY = Math.round(h * 0.60), slotW = px(22), slotH = px(30), espacoSlot = px(6);
    this.contagemSolar = this.add.text(0, rowY, `0/${n}`, letra(px(19), '#ffffff', {
      fontStyle: 'bold', stroke: '#0b1a4a', strokeThickness: px(4),
    })).setOrigin(0, 0.5);
    this.danoSolar = this.add.text(0, rowY, 'Radiation +45', letra(px(15), '#fecaca', {
      fontStyle: 'bold', stroke: '#0b1a4a', strokeThickness: px(3),
    })).setOrigin(0, 0.5);
    const grupoW = n * slotW + (n - 1) * espacoSlot + px(9) + this.contagemSolar.width + px(7) + this.danoSolar.width;
    const inicio = Math.round((w - grupoW) / 2);
    const slots = this.add.graphics();
    const tracejado = (sx: number, sy: number) => {
      const t = Math.max(1, px(2)), d = px(3), g = px(3), c = px(5);
      slots.lineStyle(t, 0xf87171, 1);
      for (let dx = c; dx < slotW - c; dx += d + g) {
        const seg = Math.min(d, slotW - c - dx), ex = sx + dx;
        slots.lineBetween(ex, sy, ex + seg, sy);
        slots.lineBetween(ex, sy + slotH, ex + seg, sy + slotH);
      }
      for (let dy = c; dy < slotH - c; dy += d + g) {
        const seg = Math.min(d, slotH - c - dy), ey = sy + dy;
        slots.lineBetween(sx, ey, sx, ey + seg);
        slots.lineBetween(sx + slotW, ey, sx + slotW, ey + seg);
      }
    };
    this.bateriasSolar = [];
    for (let i = 0; i < n; i++) {
      const sx = inicio + i * (slotW + espacoSlot), sy = rowY - Math.round(slotH / 2);
      slots.fillStyle(0x7f1d1d, 0.55).fillRoundedRect(sx, sy, slotW, slotH, px(5));
      tracejado(sx, sy);
      const bateria = criarIconeJogo(this, sx + Math.round(slotW / 2), rowY, 'energy', px(18)).setVisible(false);
      this.bateriasSolar.push(bateria);
    }
    this.contagemSolar.setX(inicio + n * slotW + (n - 1) * espacoSlot + px(9));
    this.danoSolar.setX(this.contagemSolar.x + this.contagemSolar.width + px(7));
    const instrucao = this.add.text(Math.round(w / 2), Math.round(h * 0.88), 'Batteries to the Shield, fast!', letra(px(12), '#ffffff', {
      fontStyle: 'bold',
    })).setOrigin(0.5);
    // A soft white overlay above everything: it flashes with the heartbeat animation below.
    this.flashSolar = this.add.graphics().fillStyle(0xffffff, 1)
      .fillRoundedRect(0, 0, w, h, canto).setAlpha(0);
    this.alertaSolar = this.add.container(x, y, [fundo, medalha, this.iconeSolar, anelFundo, this.anelSolar, this.tempoSolar,
      this.tituloSolar, slots, ...this.bateriasSolar, this.contagemSolar, this.danoSolar, instrucao, this.flashSolar])
      .setDepth(30).setVisible(false);
    this.proximoAlarme = 0;
    this.animacaoSolar = 0;
    this.alertaSolarX = x;
    this.alertaSolarY = y;
  }

  private resolverDesfecho(desfecho: 'protegida' | 'atingida', baterias: number) {
    const bruto = NIVEIS[Math.max(0, Math.min(NIVEIS.length - 1, sessao.dia.nivel))];
    const nome = bruto.charAt(0) + bruto.slice(1).toLowerCase();
    if (desfecho === 'atingida') {
      const dano = danoDaTempestade(baterias);
      this.danoTempestade = dano;
      this.bateriasTempestade = baterias;
      sessao.estado = { ...sessao.estado, dose: Math.min(100, sessao.estado.dose + dano) };
      sessao.emitir('estado');
      sessao.emitir('mensagem', `☢ The storm hit! Radiation +${dano}. Next time: ${this.totalBateriasSolar} batteries in the Shield.`, '#fca5a5');
      tocarSfx('erro');
    } else {
      this.danoTempestade = 0;
      this.bateriasTempestade = baterias;
      sessao.emitir('mensagem', `🛡 The Shield held the ${nome.toLowerCase()} storm!`, '#86efac');
      tocarSfx('sucesso');
    }
    this.atualizar();
  }

  private atualizarTempestade(dt: number) {
    // Radar hides the game while showing the title screen. Its emTarefa flag also
    // covers real tasks, where the storm must keep running, so use visibility.
    if (!this.scene.isVisible()) return;
    const t = sessao.tempestade;
    const jogando = sessao.fase === 'dia';
    // Tasks do not pause the storm: the deadline keeps running while the battery task is open.
    // If it expires there, the outcome waits until the player is back on the map so the report is seen.
    if (jogando && !configuracoesAbertas) {
      const desfecho = t.passo(dt, sessao.entregas.blindagem, sessao.dia.nivel);
      if (desfecho) {
        // Freeze the battery count at the instant the storm resolves; a task may finish later.
        const baterias = sessao.entregas.blindagem;
        if (sessao.emTarefa) this.desfechoPendente = { tipo: desfecho, baterias };
        else this.resolverDesfecho(desfecho, baterias);
      }
    }
    if (this.desfechoPendente && !sessao.emTarefa) {
      const pendente = this.desfechoPendente;
      this.desfechoPendente = null;
      this.resolverDesfecho(pendente.tipo, pendente.baterias);
    }
    const ativo = jogando && (t.status === 'alerta' || (t.status === 'atingida' && this.desfechoPendente !== null));
    this.alertaSolar.setVisible(ativo);
    if (!ativo) return;
    const entregues = Math.max(0, Math.min(this.totalBateriasSolar, sessao.entregas.blindagem));
    this.tempoSolar.setText(String(Math.ceil(t.restante / 1000)));
    this.contagemSolar.setText(`${entregues}/${this.totalBateriasSolar}`);
    const seguro = entregues >= this.totalBateriasSolar;
    this.danoSolar.setText(seguro ? 'SAFE' : `Radiation +${danoDaTempestade(entregues)}`);
    this.danoSolar.setColor(seguro ? '#86efac' : '#fecaca');
    this.bateriasSolar.forEach((b, i) => b.setVisible(i < entregues));
    const fracao = Math.max(0, Math.min(1, t.restante / PRAZO_TEMPESTADE_MS));
    const urgente = t.restante <= 10_000;
    this.tempoSolar.setColor(urgente ? '#fecaca' : '#ffffff');
    this.anelSolar.clear();
    if (fracao > 0) {
      this.anelSolar.lineStyle(Math.max(2, Math.round(6 * this.layout.u)), urgente ? 0xff5b5b : 0xffd93b, 1);
      this.anelSolar.beginPath();
      this.anelSolar.arc(0, 0, this.anelSolarRaio, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fracao, false);
      this.anelSolar.strokePath();
    }
    if (configuracoesAbertas) return;
    this.animacaoSolar += dt;
    const reduz = movimentoReduzido();
    // Heartbeat: the banner swells, trembles and flashes white in sync with the alarm.
    const bruto = (1 - Math.cos(this.animacaoSolar * Math.PI * 2 / 620)) / 2;
    const batida = bruto * bruto * (3 - 2 * bruto);
    const tremor = reduz ? 0 : Math.sin(this.animacaoSolar * Math.PI * 2 / 80) * 2 * batida;
    this.alertaSolar.setX(Math.round(this.alertaSolarX + tremor));
    this.alertaSolar.setY(Math.round(this.alertaSolarY + batida * (reduz ? 1 : 6) * this.layout.u));
    this.flashSolar.setAlpha(reduz ? 0 : 0.16 * batida);
    this.tituloSolar.setScale(1 + batida * (reduz ? 0 : 0.09));
    if (t.status === 'alerta') {
      this.proximoAlarme -= dt;
      if (this.proximoAlarme <= 0) { tocarSfx('alarme'); this.proximoAlarme = 2000; }
    }
  }

  // Decorative containers have no hit area: the map remains clickable between buttons.
  private criarHUD(W: number, H: number) {
    const l = this.layout = calcularLayoutHud(W, H, this.u), u = l.u;
    const px = (v: number) => Math.round(v * u);
    const movel = dispositivoMovel() && W > H;
    if (!movel) criarFaixaHud(this, l.faixa, u);
    const pad = px(8);
    if (movel) {
      this.tituloHud = undefined;
      this.textos.dia = this.add.text(0, 0, '', letra(px(12), '#dbeafe')).setVisible(false);
    } else {
      this.tituloHud = criarTituloHud(this, l.titulo, u);
      this.textos.dia = this.tituloHud.data;
    }
    const marte = sessao.mundo === 'marte';
    const descricoes: [IconeJogo, string, number][] = [['oxygen', 'Oxygen', 0x4ade80], ['radiation', 'Radiation', 0xfde047], [marte ? 'wrench' : 'rocket', sessao.cap.nomeMeta, 0x60a5fa]];
    this.recursos = l.recursos.map((r, i) => movel ? criarIndicadorCircular(this, r, u, ...descricoes[i]) : criarIndicador(this, r, u, ...descricoes[i], i === 2 && !marte));
    const menu = criarBotaoPilula(this, l.menu, u, '', () => this.abrirMenu());
    const simbolo = this.add.graphics().lineStyle(Math.max(2, px(2.5)), 0xffffff);
    const cx = Math.round(l.menu.w / 2), cy = Math.round(l.menu.h / 2);
    for (const dy of [-6, 0, 6]) simbolo.lineBetween(cx - px(7), cy + px(dy), cx + px(7), cy + px(dy));
    menu.caixa.add(simbolo).setDepth(10).setData('acao', 'menu');
    this.btMenu = menu.caixa;
    const nave = sessao.mundo === 'nave';
    const rotulosRecursos = nave ? {
      nomes: ['Batteries at the Power Room', 'Carrying batteries', 'Air recycler: batteries delivered today', 'Storm shelter: batteries delivered today', 'Engines: batteries delivered today'],
      icones: ['energy', 'backpack', 'heart', 'shield', 'rocket'],
    } : marte ? {
      nomes: ['Batteries at the lander', 'Carrying batteries', 'Life support: batteries delivered today', 'Shield: batteries delivered today', 'Heating: batteries delivered today'],
      icones: ['energy', 'backpack', 'heart', 'shield', 'energy'],
    } : undefined;
    this.capsula = movel ? criarCapsulaRecursosMovel(this, l.capsula, u, rotulosRecursos) : criarCapsulaRecursos(this, l.capsula, u, rotulosRecursos);
    const o = l.objetivo;
    this.objetivo = criarPilula(this, o.x, o.y, o.w, o.h, u, 0xfde047);
    const estrela = this.estrelaObjetivo = criarIconeJogo(this, pad + px(10), Math.round(o.h / 2), 'star', px(24));
    const tamanhoObjetivo = movel ? 15 : 12;
    const inicioTexto = px(30), larguraTexto = Math.max(1, o.w - inicioTexto - pad);
    this.textos.tarefa = this.add.text(inicioTexto + larguraTexto / 2, Math.round(o.h / 2), '', letra(px(tamanhoObjetivo), '#0b1a4a', {
      fontStyle: '700', align: 'center', wordWrap: { width: movel ? 0 : larguraTexto }, lineSpacing: 0,
    })).setOrigin(0.5);
    this.objetivo.add([estrela, this.textos.tarefa]);
    // Pulse only the star; the second-row elements stay on the same baseline.
    if (!movimentoReduzido()) this.tweens.add({ targets: estrela, alpha: 0.45, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    (['mais', 'menos', 'mira'] as const).forEach((icone, i) => criarBotaoZoom(this, l.zoom[i], u, icone,
      () => i === 2 ? sessao.irPara(U_INICIAL) : sessao.zoom(i === 0 ? -0.5 : 0.5)));
    // The Controls button opens the instructions in a panel centered on screen.
    if (movel) criarBotaoZoom(this, l.controles, u, 'controles', () => this.abrirInstrucoes()).setData('acao', 'controles');
    const nivel = criarPilula(this, l.nivel.x, l.nivel.y, l.nivel.w, l.nivel.h, u);
    this.textos.altitude = this.add.text(Math.round(l.nivel.w / 2), Math.round(l.nivel.h / 2), '', letra(px(12), '#ffffff')).setOrigin(0.5);
    nivel.add(this.textos.altitude);
  }

  // ---------- HUD ----------
  private atualizar() {
    const e = sessao.estado;
    const marte = sessao.mundo === 'marte';
    this.textos.dia.setText(sessao.fase === 'inicio'
      ? `Exploring \u00b7 ${marte ? 'Jezero crater' : sessao.mundo==='nave' ? 'Spaceship' : 'Shackleton rim'}`
      : `${marte ? 'Mars \u00b7 ' : sessao.mundo === 'nave' ? 'Ship \u00b7 ' : ''}Day ${Math.min(e.dia, C_().dias)} of ${C_().dias} \u00b7 ${dataBonita(sessao.data)}`);
    this.tituloHud?.atualizar(this.textos.dia.text);
    const valores = [e.oxigenio, e.dose, sessao.mundo==='lua'?sessao.progressoFoguete:e.meta];
    // Oxygen and crew health (100 - dose) warn by color: green above 70, yellow 30 to 70, red below 30.
    const alerta = (v: number) => v > 70 ? 0x4ade80 : v >= 30 ? 0xfde047 : 0xef4444;
    // The rocket can be finished early, but it only launches after the last day: until then the
    // crew still has to survive (regras.ts resultado), and the bar says how long.
    const faltam = C_().dias - e.dia + 1;
    const pronto = sessao.mundo === 'lua' && sessao.fase === 'dia' && valores[2] >= 100 && faltam > 0;
    const aviso = pronto ? (faltam > 1 ? `Ready! Survive ${faltam} days` : 'Ready! Last day') : undefined;
    const cores = [alerta(e.oxigenio), alerta(100 - e.dose), pronto ? 0x4ade80 : undefined];
    this.recursos.forEach((r, i) => r.atualizar(valores[i], cores[i], i === 2 ? aviso : undefined));
    const d = sessao.entregas;
    // On Mars the last counter is the heating (the dome is built through construction, not powered).
    const contadores = [sessao.noHabitat, sessao.carregando, d.oxigenio, d.blindagem, marte ? d.aquecimento : d.meta];
    this.atualizarVisibilidadeContadores();
    this.capsula.atualizar(contadores);
    // One short order at a time: where to go, what to do there.
    const origem = sessao.mundo === 'lua' ? 'Battery Bank' : marte ? 'Lander' : 'Power Room';
    let objetivo = sessao.noHabitat ? `MISSION: get today's batteries at the ${origem}`
      : sessao.carregando ? 'MISSION: give batteries to the rooms (E)' : 'Mission done! Press END DAY';
    if (sessao.tempestade.status === 'alerta') {
      objetivo = sessao.noHabitat ? 'STORM! Get batteries at the Battery Bank'
        : sessao.carregando ? 'STORM! Batteries to the Radiation Shield'
        : 'No batteries left. Hold on, the storm hits!';
    } else if (this.tempestadeHoje && d.blindagem < sessao.dia.nivel && (sessao.noHabitat || sessao.carregando)) {
      // A storm day that is not extreme: no countdown, but the Shield needs today's level in batteries
      // before the night, or the crew's dose goes up. Say it during the day, not only in the morning.
      const n = sessao.dia.nivel;
      objetivo = sessao.noHabitat ? `STORM today! Get batteries, the Shield needs ${n}`
        : `STORM! Shield ${d.blindagem}/${n} batteries`;
    } else if (sessao.mundo === 'lua' && e.dia === 1) {
      if (sessao.noHabitat) objetivo = '1/4  Get batteries at the Battery Bank (E)';
      else if (!sessao.carregando) objetivo = '4/4  All done! Press END DAY';
      else if (!d.oxigenio) objetivo = '2/4  Give 1 battery to Life Support';
      else if (!d.meta) objetivo = '3/4  Give 1 battery to the Rocket Workshop';
      else objetivo = '4/4  Share the rest, then END DAY';
    }
    if (sessao.rover?.dirigindo) objetivo = sessao.roverCarregado
      ? 'WASD to drive  ·  E to get out'
      : 'Rover needs 1 battery. E to get out';
    if (dispositivoMovel()) objetivo = objetivo
      .replaceAll('WASD to drive  ·  E to get out', 'Use the joystick to drive and USE to get out')
      .replaceAll('Rover needs 1 battery. E to get out', 'Rover needs 1 battery. Tap USE to get out')
      .replaceAll('(E)', '(USE)')
      .replaceAll('press E nearby', 'use USE nearby');
    this.textos.tarefa.setText(objetivo);

    this.textos.tarefa.setScale(1);
    const alturaDisponivel = this.layout.objetivo.h - Math.round(6 * this.layout.u);
    if (dispositivoMovel() && this.scale.width > this.scale.height) {
      // Keep the entire instruction on one line, fitting it inside the pill.
      const larguraDisponivel=Math.max(1,this.layout.objetivo.w-Math.round(38*this.layout.u));
      let tamanho = Math.round(15 * this.layout.u);
      this.textos.tarefa.setFontSize(tamanho);
      while ((this.textos.tarefa.width > larguraDisponivel || this.textos.tarefa.height > alturaDisponivel) && tamanho > 10) this.textos.tarefa.setFontSize(--tamanho);
      this.textos.tarefa.setScale(Math.min(1, larguraDisponivel / this.textos.tarefa.width, alturaDisponivel / this.textos.tarefa.height));
    } else {
      this.textos.tarefa.setScale(Math.min(1, alturaDisponivel / this.textos.tarefa.height));
    }
    const esquerdaTexto = this.textos.tarefa.x - this.textos.tarefa.displayWidth / 2;
    this.estrelaObjetivo.setX(Math.max(Math.round(12*this.layout.u), esquerdaTexto - Math.round(16*this.layout.u)));

    const menu=sessao.fase === 'inicio';
    this.textoFim.setText(menu ? 'MENU' : 'END DAY');
    if(dispositivoMovel() && this.scale.width > this.scale.height){
      // The translated label may be wider than English; keep the arrow inside the pill.
      let tamanho=Math.round(17*Math.max(this.layout.u,1));
      this.textoFim.setFontSize(tamanho);
      while(this.textoFim.width>this.layout.fimDia.w-38 && tamanho>10)this.textoFim.setFontSize(--tamanho);
    }
    const tamanhoIcone=dispositivoMovel()?14*Math.max(this.layout.u,1):18*this.layout.u;
    const distancia=(this.textoFim.width+tamanhoIcone+8)/2;
    this.textoFim.setX(menu?6:-6);
    const x=menu?-distancia:distancia;
    this.iconeFim.clear().fillStyle(0xffffff).fillTriangle(
      x+(menu?tamanhoIcone/2:-tamanhoIcone/2),-tamanhoIcone/2,
      x+(menu?tamanhoIcone/2:-tamanhoIcone/2),tamanhoIcone/2,
      x+(menu?-tamanhoIcone/2:tamanhoIcone/2),0,
    );
    const mostrarFim = (sessao.fase === 'dia' || sessao.fase === 'inicio')
      && !(sessao.explorando && (sessao.mundo === 'nave' || sessao.mundo === 'marte'));
    this.btFim.setVisible(mostrarFim);
    if (this.btFim.input) this.btFim.input.enabled = mostrarFim;
  }

  painelAberto() { return this.painel.length > 0; }

  private atualizarVisibilidadeContadores() {
    const movel=dispositivoMovel() && this.scale.width > this.scale.height;
    const visivel=mostrarHudNaSuperficie(movel,sessao.mundo,sessao.vista,sessao.voo,sessao.transicao);
    this.capsula.caixa.setVisible(mostrarContadoresHud(movel,sessao.mundo,sessao.fase,sessao.vista,sessao.voo,sessao.transicao));
    this.recursos.forEach(r=>r.caixa.setVisible(visivel && sessao.fase !== 'inicio'));
    this.objetivo.setVisible(visivel && (sessao.fase === 'dia' || (sessao.fase === 'inicio' && !!sessao.rover?.dirigindo)));
  }

  // Notices: the dark pill of the task screens, above the bottom bar. Green good news, yellow careful.
  // A customization prize: a card in the upper middle with the item's picture. Messages do not replace it
  // (they live at the bottom); it closes by itself after a few seconds, or on a tap.
  private cartaoPremio?: Phaser.GameObjects.Container;
  private mostrarPremio(p: { titulo: string; nome: string; chave: string; quadro: number; corpo: boolean }) {
    this.cartaoPremio?.destroy();
    const u = this.u, W = this.scale.width, H = this.scale.height;
    const w = Math.min(W - 40 * u, 400 * u), h = 150 * u, ix = -w / 2 + 72 * u;
    const g = this.add.graphics()
      .fillStyle(0x0b1a4a, 0.7).fillRoundedRect(-w / 2 + 3 * u, -h / 2 + 5 * u, w, h, 22 * u)
      .fillStyle(0x1d4ed8).fillRoundedRect(-w / 2, -h / 2, w, h, 22 * u)
      .lineStyle(4 * u, 0xfde047).strokeRoundedRect(-w / 2, -h / 2, w, h, 22 * u)
      .fillStyle(0x0f172a, 0.55).fillCircle(ix, 0, 56 * u);
    const partes: Phaser.GameObjects.GameObject[] = [g];
    const F = sprite.frame, cx = 52, cy = 4, cw = 88, ch = 104;   // the head of a frame (hats, glasses and faces live there)
    const cabeca = (chave: string) => this.add.image(ix, 0, chave, p.quadro).setCrop(cx, cy, cw, ch).setOrigin((cx + cw / 2) / F, (cy + ch / 2) / F).setScale(1.0 * u);
    if (p.chave && this.textures.exists(p.chave)) {
      if (p.corpo) partes.push(this.add.image(ix, 0, p.chave, p.quadro).setOrigin(0.5, 0.5).setScale(0.62 * u));
      else partes.push(cabeca(chaveSkin(SKIN_PADRAO)), cabeca(p.chave));
    } else partes.push(this.add.text(ix, 0, '🎨', letra(52 * u)).setOrigin(0.5));
    const tx = ix + 74 * u, larg = w / 2 - tx - 16 * u;
    partes.push(
      this.add.text(tx, -26 * u, p.titulo, letra(26 * u, '#fde047', { stroke: '#1e293b', strokeThickness: 6 * u })).setOrigin(0, 0.5),
      this.add.text(tx, 14 * u, p.nome, letra(20 * u, '#ffffff', { wordWrap: { width: larg } })).setOrigin(0, 0.5),
      this.add.text(w / 2 - 14 * u, h / 2 - 12 * u, 'In the wardrobe at the Habitat', letra(11 * u, '#bfdbfe')).setOrigin(1, 1),
    );
    const c = this.add.container(W / 2, H * 0.3, partes).setDepth(35).setSize(w, h).setInteractive({ useHandCursor: true });
    this.cartaoPremio = c;
    tocarSfx('sucesso');
    const fechar = () => { if (!c.active) return; this.tweens.add({ targets: c, alpha: 0, scale: 0.8, duration: 250, onComplete: () => c.destroy() }); };
    c.on('pointerdown', fechar);
    if (!movimentoReduzido()) { c.setScale(0.4).setAlpha(0); this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 350, ease: 'Back.easeOut' }); }
    this.time.delayedCall(5000, fechar);
  }

  private mensagem(s: string, cor = '#ffffff') {
    this.aviso?.destroy();
    const u = this.u;
    const W = this.scale.width, H = this.scale.height;
    const largura = Math.min(W - 32 * u, 680 * u), pad = 18 * u, reserva = 38 * u;
    const primeiro = s.match(/^\p{Extended_Pictographic}\uFE0F?/u)?.[0];
    const id = primeiro ? resolverIcone(primeiro) : cor === '#86efac' ? 'success' : cor === '#fca5a5' || cor === '#fde68a' ? 'warning' : 'helmet';
    const t = this.add.text(reserva/2, 0, textoDoJogo(s), letra(16 * u, cor === '#e2e8f0' ? '#ffffff' : cor, { align: 'center', wordWrap: { width: largura - 2 * pad - reserva }, lineSpacing: 2 * u })).setOrigin(0.5);
    const w = Math.min(largura, t.width + 2 * pad + reserva), h = Math.max(42 * u,t.height + 18 * u), r = Math.min(h / 2, 24 * u);
    const icone = criarIconeJogo(this,-w/2+pad+14*u,0,id,30*u);
    const g = this.add.graphics()
      .fillStyle(0x0b1a4a, 0.7).fillRoundedRect(-w / 2 + 2 * u, -h / 2 + 4 * u, w, h, r)
      .fillStyle(CONTORNO, 0.96).fillRoundedRect(-w / 2, -h / 2, w, h, r)
      .lineStyle(3 * u, 0xffffff).strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    // On touch, keep notices above the bottom resource icons, regardless of text height.
    const movel = dispositivoMovel() && W > H;
    const baseAviso = movel ? this.layout.capsula.y - Math.max(6, Math.round(8 * u)) : H - 70 * u;
    const c = this.add.container(W / 2, baseAviso - h / 2, [g, icone, t]).setDepth(20);
    this.aviso = c;
    if (!movimentoReduzido()) {
      c.setScale(0.6).setAlpha(0);
      this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    }
    // Longer notices stay longer, so there is time to read them.
    this.tweens.add({ targets: c, alpha: 0, delay: Math.max(5500, s.length * 90), duration: 700, onComplete: () => c.destroy() });
  }

  // ---------- chapter flow (rules: ../regras.ts) ----------
  private irPara(f: Fase) {
    sessao.fase = f;
    if (f !== 'noite') this.eventoPerdido = undefined;
    if (f === 'dia') {
      this.danoTempestade = 0;
      this.bateriasTempestade = 0;
    }
    sessao.emitir('fase', f);
    this.atualizar();
    this.mostrarFase();
    if (f === 'dia' && sessao.tempestade.status === 'alerta') {
      sessao.emitir('mensagem', `⏱ Storm coming! ${this.totalBateriasSolar} batteries to the Radiation Shield, fast!`, '#fde68a');
    } else if (f === 'dia' && this.tempestadeHoje) {
      const n = sessao.dia.nivel;
      sessao.emitir('mensagem', `☀ Solar storm today! Give ${n} batter${n === 1 ? 'y' : 'ies'} to the Radiation Shield before END DAY.`, '#fde68a');
    }
  }

  // A Moon day with a solar storm below the extreme alarm (dados/lua.json nivel 1-2).
  private get tempestadeHoje() {
    return sessao.mundo === 'lua' && sessao.fase === 'dia' && sessao.dia.nivel > 0 && sessao.tempestade.status === 'inativa';
  }

  private terminarDia() {
    if (sessao.abastecendoRover) return;
    // While exploring, this button goes back to the title screen.
    if (sessao.fase === 'inicio') { if (sessao.explorando) this.abrirMenu(); else this.mostrarFase(); return; }
    if (sessao.fase !== 'dia') return;
    this.atualizarTempestade(0);
    if (sessao.tempestade.status === 'alerta') {
      sessao.emitir('mensagem', '⚠ Power the Radiation Shield first!', '#fde68a');
      return;
    }
    // A day never ends with an alarm unfinished: one already on must be fixed first, and one still on its way
    // goes off right now (its countdown is cut to zero; Superficie.passarEventos starts it on the next frame).
    if (sessao.evento?.def.alarme) {
      const nome = sessao.grade.lista.find((c) => c.id === sessao.evento!.construcaoId)?.tipo.nome ?? 'module';
      sessao.emitir('mensagem', `☢ Not yet! Fix the alarm at the ${nome} first.`, '#fca5a5');
      return;
    }
    if (sessao.alarmeHoje && sessao.mundo === 'lua') {
      sessao.eventoEm = 0;
      sessao.emitir('mensagem', '☢ Wait! An alarm is going off before the day ends.', '#fca5a5');
      return;
    }
    const antes = sessao.estado;
    const dia = sessao.dia;
    const condicao = sessao.condicaoHoje;   // read before fimDoDia moves the day on
    const ataque = sessao.tempestade.status === 'atingida';
    const aloc = ataque ? { ...sessao.entregas, blindagem: dia.nivel } : sessao.entregas;
    sessao.estado = fimDoDia(antes, aloc, dia, C_());
    if (sessao.evento?.def.efeito === 'radiacao') sessao.estado = { ...sessao.estado, dose: Math.min(100, sessao.estado.dose + DOSE_ALARME) };
    if (condicao === 'estufa') sessao.estado = { ...sessao.estado, oxigenio: Math.max(0, sessao.estado.oxigenio - ESTUFA_OXIGENIO) };
    this.ultimoDia = { antes, entregas: { ...sessao.entregas }, nivel: dia.nivel, fato: dia.fato, frio: dia.frio ?? 0,
      danoTempestade: ataque ? this.danoTempestade : 0, bateriasTempestade: this.bateriasTempestade };
    sessao.carregando = 0;
    sessao.noHabitat = 0;
    this.irPara('noite');
    sessao.emitir('estado');
  }

  private get ultimoDia() { return sessao.ultimoDia ?? undefined; }
  private set ultimoDia(v: RelatorioDia | undefined) { sessao.ultimoDia=v??null; }

  private mostrarFase() {
    this.fecharPainel();
    const f = sessao.fase;
    if (f === 'inicio') {
      if (sessao.explorando) return;
      // Title screen (Radar.ts): LAUNCH starts the first morning; "Explore" leaves the base open.
      // The title screen has its own music switch: refresh ours when it closes.
      const dados: DadosRadar = {
        aoComecar: () => this.irPara('manha'),
        aoExplorar: mundo => this.explorarBase(mundo ?? 'lua'),
      };
      this.scene.launch('Radar', dados);
    } else if (f === 'manha') {
      const d = sessao.dia;
      const n = sessao.bateriasHoje;
      const cond = sessao.condicaoHoje;
      const enf = naEnfermaria(sessao.estado);
      const marte = sessao.mundo === 'marte';
      const sup = suprimentoDoMundo(sessao.mundo, sessao.estado.dia);
      const lua = sessao.mundo === 'lua', dia1 = sessao.estado.dia === 1;
      const intro = !lua && dia1 ? sessao.cap.introducao.map((t) => ({ icone: marte ? 'mars' : 'rocket', texto: t, cor: '#fde68a' })) : [];
      // One short line per bubble, the icon says what it is about. Story first, then today's numbers.
      this.abrirPainel(`${marte ? 'Mars \u00b7 ' : sessao.mundo === 'nave' ? 'Ship \u00b7 ' : ''}Day ${sessao.estado.dia} \u00b7 ${dataBonita(sessao.data)}`, CONTROLE, [
        ...intro,
        ...(lua && dia1 ? [{ icone: 'rocket', texto: 'Our rocket broke on the trip. Build a new one to fly to Mars!', cor: '#fde047', negrito: true }] : []),
        { icone: 'sun', texto: d.curto },
        ...(cond ? [{ icone: 'warning', texto: CONDICOES[cond].aviso(sessao.mundo), cor: '#fde68a', negrito: true }] : []),
        ...(cond === 'sinal' ? [] : [{ icone: 'radiation', texto: `Forecast: ${NIVEIS[d.previsao[0]]}${d.previsao[0]===d.previsao[1]?'':` to ${NIVEIS[d.previsao[1]]}`}. Shield: ${d.previsao[0]}${d.previsao[0]===d.previsao[1]?'':`–${d.previsao[1]}`} batteries.`, cor: '#fde68a', negrito:true },]),
        ...(lua && d.previsao[1] >= 3 && cond !== 'sinal' ? [{ icone: 'timer', texto: `If the extreme-storm alarm sounds: ${PRAZO_TEMPESTADE_MS / 1000} seconds to deliver 3 Shield batteries.`, cor: '#fde68a', negrito: true }] : []),
        ...(marte && d.frio ? [{ icone: 'cold', texto: `Cold night: ${d.minima ?? ''} \u00b0C! Heating needs ${d.frio} batteries.`, cor: '#93c5fd', negrito: true }] : []),
        { icone: 'energy', texto: `${n} batteries today.`, cor: '#86efac', negrito: true },
        ...(enf ? [{ icone: 'heart', texto: `${enf} astronaut${enf > 1 ? 's are' : ' is'} sick: ${enf} fewer batteries.`, cor: '#fca5a5' }] : []),
        ...(sup ? [{ icone: 'cargo', texto: sup.aviso, cor: '#fde68a', negrito: true }] : []),
        ...(lua && dia1 && guiaVaiRodar() ? [{ icone: 'goal', texto: 'Follow the yellow arrows!', cor: '#fde047', negrito: true }] : []),
        ...((lua || marte) && sessao.rover && !dia1 ? [{ icone: 'rover', texto: 'Rover: 1 battery = drive all day.' }] : []),
        ...(lua && dia1 ? [
          dispositivoMovel()
            ? 'First mission: pick up batteries at the Battery Bank, then take one to Life Support and one to the Rocket Workshop. Move with the joystick and tap USE nearby.'
            : 'First mission: pick up batteries at the Battery Bank, then take one to Life Support and one to the Rocket Workshop. Click a building or press E nearby.',
        ] : []),
      ], [{ texto: 'GO!  \u25b6', acao: () => {
        sessao.novoDia(); this.irPara('dia');
        if (sup) this.entregaPendente = this.time.delayedCall(1200, () => sessao.emitir('suprimento', sup.tipo));
      }, principal: true }]);
    } else if (f === 'noite') {
      const u = this.ultimoDia!;
      const e = sessao.estado;
      const delta = (a: number, b: number) => `${b - a >= 0 ? '+' : ''}${Math.round(b - a)}`;
      const desprotegido = Math.max(0, u.nivel - u.entregas.blindagem);
      const r = resultado(e, C_());
      const condOntem = sessao.condicoes[sessao.estado.dia - 2] ?? null;   // the day that just ended (dia already moved on)
      // A problem left unfixed is told here, then forgotten: tomorrow is a new day.
      // Kept for the whole night, so reopening the report (after Real NASA data) still tells it.
      if (sessao.evento) this.eventoPerdido = sessao.evento.def;
      const perdido = this.eventoPerdido;
      sessao.evento = null;
      // One line per bar, with an arrow: green when it got better, red when it got worse.
      // The numbers say it: value, arrow, green when it got better and red when it got worse.
      const linha = (icone: string, nome: string, valor: number, antes: number, maisEhBom: boolean) => {
        const d0 = Math.round(valor - antes);
        const seta = d0 > 0 ? `   \u25b2 ${d0}` : d0 < 0 ? `   \u25bc ${-d0}` : '';
        const bom = d0 === 0 ? null : (d0 > 0) === maisEhBom;
        return { icone, texto: `${nome}: ${Math.round(valor)}%${seta}`, cor: bom === null ? '#ffffff' : bom ? '#86efac' : '#fca5a5', negrito: true };
      };
      const marte = sessao.mundo === 'marte';
      const dadosReais: Botao = { texto: 'Real NASA data', acao: () => this.abrirDados(() => this.mostrarFase()) };
      this.abrirPainel('Night report', COMPUTADOR, [
        linha('oxygen', 'Oxygen', e.oxigenio, u.antes.oxigenio, true),
        linha('radiation', 'Radiation', e.dose, u.antes.dose, false),
        linha(marte ? 'wrench' : 'rocket', sessao.cap.nomeMeta, e.meta, u.antes.meta, true),
        desprotegido
          ? { icone: 'warning', texto: `The Shield was ${desprotegido} batter${desprotegido > 1 ? 'ies' : 'y'} short. Ouch, radiation!`, cor: '#fde68a' }
          : { icone: 'shield', texto: 'The Shield held. Crew safe!', cor: '#86efac' },
        ...(u.danoTempestade ? [{ icone: 'radiation', texto: `The storm hit: +${u.danoTempestade} radiation.`, cor: '#fca5a5' }] : []),
        ...(u.frio ? [u.entregas.aquecimento < u.frio
          ? { icone: 'cold', texto: `Too cold! -${(u.frio - u.entregas.aquecimento) * 10} oxygen.`, cor: '#fca5a5' }
          : { icone: 'cold', texto: 'Heating on. Machines stayed warm!', cor: '#86efac' }] : []),
        ...(perdido ? [perdido.efeito === 'radiacao'
          ? { icone: 'radiation', texto: `Alarm missed: +${DOSE_ALARME} radiation.`, cor: '#fde68a' }
          : { icone: 'wrench', texto: 'Side mission skipped. No problem: it was optional.', cor: '#bfdbfe' }] : []),
        ...(condOntem ? [{ icone: 'idea', texto: CONDICOES[condOntem].fato, cor: '#bfdbfe' }] : []),
        { icone: 'idea', texto: u.fato, tamanho: 16, cor: '#bfdbfe' },
      ], [dadosReais, { texto: r ? 'SEE THE RESULT  \u25b6' : 'NEXT MORNING  \u25b6', acao: () => this.irPara(r ? 'fim' : 'manha'), principal: true }]);
    } else if (f === 'fim') {
      const e = sessao.estado;
      const r = resultado(e, C_());
      const marte = sessao.mundo === 'marte';
      // The whole game is won (Mars, the last chapter): party on the map, then the camera pulls back to
      // the solar system, and the result opens there.
      if (marte && r === 'vitoria' && !this.comemorou) {
        this.comemorou = true;
        this.comemorarVitoria(() => this.mostrarFase());
        return;
      }
      const titulo = r === 'vitoria' ? (marte ? 'Mission complete!' : 'Launch! To Mars!') : r === 'sem-oxigenio' ? 'Out of oxygen' : r === 'radiacao' ? 'Too much radiation'
        : marte ? 'The base was not finished' : 'The rocket was not ready';
      // Result, score (with what it is made of), then the lessons of the chapter and where the data came from.
      const venceu = r === 'vitoria';
      const pontos = [...sessao.pontos, pontuacao(e)];
      const dadosReais: Botao = { texto: 'Real NASA data', acao: () => this.abrirDados(() => this.mostrarFase()) };
      // The choice that led to the result, in kid words. Room names come from the chapter.
      const sala = (ef: string) => sessao.cap.salas.find((s) => s.efeito === ef)!.nome;
      const porque = r === 'sem-oxigenio' ? `Why: ${sala('oxigenio')} got too few batteries, so the air ran out.`
        : r === 'radiacao' ? `Why: the ${sala('blindagem')} got fewer batteries than the solar storms needed.`
        : r === 'meta-incompleta' ? `Why: too few batteries went to the ${sessao.cap.nomeMeta} before the last day.`
        : venceu ? `Why it worked: you kept the air and the Shield safe AND still finished the ${sessao.cap.nomeMeta}.` : null;
      const conceitos = this.conceitosVistos();
      const placar = [
        { icone: venceu ? 'check' : 'cross', texto: venceu ? sessao.cap.vitoria[1] : r === 'sem-oxigenio' ? 'The crew ran out of oxygen. Power Life Support before ending the day.' : r === 'radiacao' ? 'Radiation became too high. Power the Shield when a storm is forecast.' : sessao.cap.metaIncompleta, negrito: true },
        ...(porque ? [{ icone:'idea',texto:porque,cor:'#fde68a',negrito:true }] : []),
        { icone: 'star', texto: `${pontuacao(e)} points!`, cor: '#fde047', negrito: true, tamanho: 26 },
        { icone: 'oxygen', texto: `Oxygen  ${Math.round(e.oxigenio)}`, negrito: true },
        { icone: 'heart', texto: `Health  ${Math.round(100 - e.dose)}`, negrito: true },
        { icone: marte ? 'wrench' : 'rocket', texto: `${sessao.cap.nomeMeta}  ${Math.round(e.meta)}`, negrito: true },
        ...(marte && venceu ? [{ icone: 'star', texto: `All chapters: ${pontos.reduce((a, b) => a + (b ?? 0), 0)} of ${300 * CAPITULOS.length}`, cor: '#fde047', negrito: true }] : []),
        { icone: 'idea', texto: 'STEM concepts you met:', cor: '#bfdbfe', negrito: true },
        ...conceitos.map((c) => ({ icone: 'idea', texto: c, cor: '#bfdbfe' })),
        ...sessao.cap.licoes.filter((l) => !conceitos.includes(l)).map((l) => ({ icone: 'idea', texto: l, cor: '#bfdbfe' })),
        { icone: 'antenna', texto: sessao.cap.notaDados, cor: '#94a3b8', tamanho: 15 },
      ];
      if (sessao.mundo === 'nave') {
        // Chapter 2 ends at Mars: the arrival film (Chegada, like the Moon's), then chapter 3 opens with the landing.
        this.abrirPainel(venceu ? sessao.cap.vitoria[0] : r === 'sem-oxigenio' ? 'Out of oxygen' : r === 'radiacao' ? 'Too much radiation' : 'The ship missed Mars', CONTROLE, placar, venceu
          ? [dadosReais, { texto: 'Land on Mars  ▶', acao: () => { this.fecharPainel(); this.scene.launch('Chegada', { mundo: 'marte', aoTerminar: () => iniciarMarte3D(this, e.dose, pontos) }); this.scene.bringToTop('Chegada'); }, principal: true }]
          // Trying again: the crew rests first (regras.ts DESCANSO).
          : [dadosReais, { texto: 'Try the trip again', acao: () => iniciarNave3D(this, Math.min(e.dose, DESCANSO), sessao.pontos), principal: true }]);
        return;
      }
      if (marte) {
        this.abrirPainel(titulo, CONTROLE, placar, [dadosReais,
          ...(!venceu ? [{ texto: 'Try Mars again', acao: () => iniciarMarte3D(this,Math.min(e.dose,DESCANSO),sessao.pontos,false), principal:true }] : []),
          { texto: 'PLAY AGAIN FROM THE MOON', acao: () => this.novoJogo(), principal:venceu },
        ]);
        return;
      }
      const jogarDeNovo = { texto: venceu ? 'PLAY CHAPTER 1 AGAIN' : 'PLAY AGAIN', acao: () => { sessao.reiniciar(); this.scene.get('Superficie').scene.restart(); this.irPara('inicio'); } };
      this.abrirPainel(titulo, CONTROLE, placar, venceu
        ? [dadosReais, jogarDeNovo, { texto: 'Board the ship  ▶', acao: () => this.embarcar(e), principal: true }]
        : [dadosReais, { ...jogarDeNovo, principal: true }]);
    }
  }

  // ---------- the final victory ----------
  private comemorou = false;

  // Confetti and fireworks over the map, then the flight out: ground -> Mars globe -> solar system.
  // `fim` runs once the solar system is on screen (or after a safety timeout, if a flight cannot run).
  private comemorarVitoria(fim: () => void) {
    const W = this.scale.width, H = this.scale.height, u = this.layout.u;
    const reduzido = movimentoReduzido();
    tocarSfx('sucesso');
    this.time.delayedCall(600, () => tocarSfx('sucesso'));
    sessao.emitir('mensagem', '🎉 MISSION COMPLETE! Moon, deep space and Mars: you did it all!', '#fde047');
    const cores = [0xfde047, 0xf97316, 0x22c55e, 0x38bdf8, 0xf472b6, 0xffffff];
    const efeitos: Phaser.GameObjects.GameObject[] = [];
    if (!reduzido) {
      if (!this.textures.exists('confete')) this.make.graphics({}, false).fillStyle(0xffffff).fillRect(0, 0, 8, 5).generateTexture('confete', 8, 5).destroy();
      if (!this.textures.exists('particula')) this.make.graphics({}, false).fillStyle(0xffffff).fillCircle(3, 3, 3).generateTexture('particula', 6, 6).destroy();
      // Confetti falling from the top, turning as it goes.
      const confete = this.add.particles(0, 0, 'confete', {
        x: { min: 0, max: W }, y: -12, lifespan: 4200,
        speedX: { min: -60, max: 60 }, speedY: { min: 90, max: 220 }, gravityY: 60,
        rotate: { start: 0, end: 540 }, scale: { min: 0.8 * u, max: 1.5 * u },
        tint: cores, frequency: LEVE ? 220 : 110, maxAliveParticles: LEVE ? 20 : 45,
      }).setDepth(-0.5);
      // Fireworks: a burst at a random spot now and then.
      const fogos = this.add.particles(0, 0, 'particula', {
        lifespan: 1100, speed: { min: 90, max: 260 }, gravityY: 120,
        scale: { start: 1.3 * u, end: 0 }, alpha: { start: 1, end: 0 }, tint: cores,
        blendMode: 'ADD', emitting: false, maxAliveParticles: LEVE ? 30 : 70,
      }).setDepth(-0.5);
      const estouro = this.time.addEvent({ delay: 700, repeat: 7, callback: () => {
        fogos.explode(LEVE ? 10 : 18, Phaser.Math.Between(W * 0.15, W * 0.85), Phaser.Math.Between(H * 0.15, H * 0.55));
        tocarSfx('zap');
      } });
      efeitos.push(confete, fogos);
      // Stop the confetti once the solar system is reached and let the last pieces fall.
      this.events.once('vitoria-fim', () => { estouro.remove(); confete.stop(); fogos.stop();
        this.time.delayedCall(4500, () => efeitos.forEach((o) => o.destroy())); });
    }

    // The flight out, one view at a time (the ground and the globe are joined by the film).
    let acabou = false;
    const terminar = () => { if (acabou) return; acabou = true; olhar.remove(); seguranca.remove(); this.events.emit('vitoria-fim'); fim(); };
    const seguranca = this.time.delayedCall(25_000, terminar);
    const inicio = this.time.now + (reduzido ? 600 : 2200);   // a moment of party on the map first
    let chegouEm = 0;
    const olhar = this.time.addEvent({ delay: 200, loop: true, callback: () => {
      if (sessao.voo || sessao.transicao || this.time.now < inicio) return;
      if (sessao.vista === 'chao') sessao.voar('lua');
      else if (sessao.vista === 'lua') sessao.voar('sistema');
      else if (!chegouEm) chegouEm = this.time.now;
      else if (this.time.now - chegouEm > 1500) terminar();
    } });
  }

  // STEM concepts the player met in this chapter, from the days reached and the final state.
  // Random events can push more concepts into this list.
  conceitosVistos(): string[] {
    const e = sessao.estado;
    const vistos = sessao.cap.dados.dias.slice(0, e.dia); // dia is days + 1 at the end: slice takes them all
    const conceitos: string[] = [];
    if (vistos.some((d) => d.nivel >= 1)) conceitos.push('Solar storms and space radiation');
    if (sessao.cap.tema === 'lua') conceitos.push('The Moon has no magnetic field to block radiation');
    if (vistos.some((d) => (d.frio ?? 0) > 0)) conceitos.push('Mars has thin air, so nights get very cold');
    if (e.dose >= 25) conceitos.push('Radiation harms astronaut health');
    // Days already played (dia is the next day; at the end of a chapter it is days + 1, so all count).
    const condicoes = new Set(sessao.condicoes.slice(0, Math.max(0, e.dia - 1)).filter((c): c is Condicao => c !== null));
    for (const c of condicoes) conceitos.push(CONDICOES[c].conceito);
    conceitos.push('In space every choice has a cost: energy is limited');
    return conceitos;
  }

  devValores() { return { ...sessao.estado }; }
  devAplicar(valores: Pick<Estado, 'oxigenio' | 'dose' | 'meta'>) {
    if (sessao.fase !== 'dia') { sessao.novoDia(); this.irPara('dia'); }
    sessao.estado = { ...sessao.estado, ...valores };
    sessao.emitir('estado');
  }
  devTempestade() {
    if (sessao.mundo !== 'lua') return;
    if (sessao.fase !== 'dia') { sessao.novoDia(); this.irPara('dia'); }
    sessao.nivelTeste = 3;
    sessao.entregas.blindagem = 0;
    sessao.noHabitat = Math.max(sessao.noHabitat, 3 - sessao.carregando);
    sessao.tempestade.iniciar(3);
    this.proximoAlarme = 0;
    sessao.emitir('estado');
    this.atualizarTempestade(0);
  }
  // DEV: win the whole game on Mars right now (the final celebration and the flight out to the planets).
  devVencerJogo() {
    if (sessao.mundo !== 'marte') return false;
    this.fecharPainel();
    sessao.emTarefa = false;
    if (sessao.vista !== 'chao') sessao.voar('chao');
    sessao.estado = { ...sessao.estado, meta: 100, oxigenio: Math.max(60, sessao.estado.oxigenio), dose: Math.min(30, sessao.estado.dose), dia: C_().dias + 1 };
    sessao.tempestade.iniciar(0);
    this.comemorou = false;
    this.irPara('fim');
    return true;
  }

  devResultado(finalCapitulo: boolean) {
    if (finalCapitulo) sessao.estado = { ...sessao.estado, dia: C_().dias + 1 };
    const r = resultado(sessao.estado, C_());
    if (r) { sessao.tempestade.iniciar(0); this.irPara('fim'); }
    return r;
  }

  // The rocket lifts off the pad (Superficie), meets the Mars ship in lunar orbit and the ship
  // crosses to Mars on the zoom out (sessao.partir, drawn by Espaco), then the
  // crew continues in chapter 2.
  private embarcar(e: Estado) {
    this.fecharPainel();
    const sup = this.scene.get('Superficie') as unknown as { decolar(fim: () => void): void };
    sup.decolar(() => sessao.partir(() => this.iniciarPrototipo(e)));
  }

  // Chapter 2 runs on this same engine, on the ship's deck (irParaMarte.ts). Hand the crew over
  // keeping its radiation dose and the score so far.
  private iniciarPrototipo(e: Estado) {
    iniciarNave3D(this, e.dose, [pontuacao(e)]);
  }

  private fecharPainel() {
    this.timersChat.forEach((t) => t.remove());
    this.timersChat = [];
    this.painel.forEach((o) => o.destroy());
    this.painel = [];
    this.acaoPrincipal = undefined;
  }

  // Real NASA data of the chapter: one line per day, the instrument, and the sources (as text).
  // Copied from Base.ts painelDados. BACK calls voltar, which reopens the panel the player came from.
  abrirDados(voltar: () => void) {
    const dados = sessao.cap.dados;
    const linhas: Parte[] = [
      `Each day of this chapter is a real day from May 2024. The radiation level comes from the dose measured by ${dados.instrumento}.`,
      ...(sessao.cap.tema === 'lua' ? ["The Moon dose was measured in lunar orbit by NASA's LRO spacecraft, not on the ground."] : []),
      // Only the days already played (dia has moved on at night): the next storms stay a surprise.
      ...dados.dias.slice(0, sessao.estado.dia - 1).map((d) => ({ texto: `${dataBonita(Date.parse(`${d.data}T12:00:00Z`))}: ${d.doseMedia} µGy/h  →  ${NIVEIS[d.nivel]}`, cor: CORES_NIVEL[d.nivel], negrito: true })),
      { texto: 'Archived NASA data from May 2024, not live.', cor: '#94a3b8', tamanho: 14 },
      { texto: 'Sources:', cor: '#94a3b8', tamanho: 14 },
      ...dados.fontes.flatMap((f) => [{ texto: f.nome, tamanho: 14 }, { texto: f.url, cor: '#94a3b8', tamanho: 12 }]),
    ];
    this.abrirPainel('Real NASA data in this chapter', COMPUTADOR, linhas, [{ texto: 'BACK', acao: voltar, principal: true }]);
  }

  // Morning, night and end panels: the same size as a task panel (660 x 480 at the UI scale), told as a
  // chat. The messages arrive one by one, each after a moment of "typing...". When they do not all fit,
  // they go on pages: NEXT shows the following page, the real buttons wait on the last one. A click or
  // ENTER first shows the whole page at once. The window shrinks on small screens so it always fits;
  // { imediato } skips the typing and shows the page at once (the mobile instructions panel).
  private abrirPainel(titulo: string, quem: Remetente, partes: Parte[], botoes: Botao[], opcoes: { imediato?: boolean } = {}) {
    this.fecharPainel();
    if (quem===CONTROLE) tocarSfx('radio');
    this.aviso?.destroy();   // an old notice would sit on top of the panel
    this.aviso = undefined;
    const W = this.scale.width, H = this.scale.height, k = this.u;
    const itens = partes.map((p0) => {
      const p = typeof p0 === 'string' ? { texto: p0 } : p0;
      return { ...p, texto: textoDoJogo(p.texto), icone: p.icone ? resolverIcone(p.icone) : undefined };
    });
    const largura = Math.min(W - 40 * k, 660 * k), altura = Math.min(H - 40 * k, 480 * k);
    const x0 = (W - largura) / 2, y0 = (H - altura) / 2 + 8 * k;
    const util = largura - 52 * k - 96 * k - 32 * k;   // frame, avatar column and margins, bubble padding
    const estilo = (p: (typeof itens)[number], util0: number) => letra((p.tamanho ?? 18) * k, p.cor ?? '#ffffff', {
      wordWrap: { width: util0, useAdvancedWrap: true }, fontStyle: p.negrito ? '700' : '500', lineSpacing: 2 * k,
    });

    const antes = this.children.list.length;
    const fundo = this.add.rectangle(0, 0, W, H, 0x020617, 0.55).setOrigin(0).setInteractive();
    const { tela, rodape, borda } = moldura(this, { x: x0, y: y0, w: largura, h: altura }, k, titulo.toUpperCase());

    // Sender: round avatar on the left, name over the first bubble.
    const topo = tela.y + 16 * k;
    const ax = tela.x + 22 * k + 20 * k, bx = tela.x + 74 * k;
    this.add.container(ax, topo + 22 * k + 20 * k, [
      discoAzul(this.add.graphics(), 40 / 52 * k, quem.cor),
      this.add.text(0, 0, quem.sigla, letra(14 * k)).setOrigin(0.5),
    ]);
    this.add.text(bx + 4 * k, topo + 10 * k, quem.nome, letra(14 * k, '#fde047')).setOrigin(0, 0.5);

    // One bubble per message: an icon and a short line in a dark pill with a white edge.
    // A bubble taller than a whole page (it should not happen with short texts) is scaled down to fit.
    const yInicio = topo + 22 * k, yFim = tela.y + tela.h - 14 * k;
    const bolhas = itens.map((p) => {
      const ic = p.icone ? 36 * k : 0, dx = p.icone ? 48 * k : 0;
      const t = this.add.text(16 * k + dx, 0, p.texto, estilo(p, util - dx));
      const w = t.width + 32 * k + dx, h = Math.max(t.height, ic) + 22 * k;
      t.setY((h - t.height) / 2);
      const g = this.add.graphics();
      const c = this.add.container(bx, 0, [g, t]).setVisible(false);
      if (p.icone) c.add(criarIconeJogo(this, 16 * k + ic / 2, h / 2, p.icone, ic));
      const s = Math.min(1, (yFim - yInicio) / h);
      c.setScale(s);
      return { c, g, w, h, s };
    });
    // Pages: as many bubbles as fit, top to bottom.
    const paginas: number[][] = [[]];
    let y = yInicio;
    bolhas.forEach((b, i) => {
      if (y + b.h * b.s > yFim && paginas[paginas.length - 1].length) { paginas.push([]); y = yInicio; }
      const primeira = !paginas[paginas.length - 1].length;
      paginas[paginas.length - 1].push(i);
      b.c.setY(y);
      // Only the first bubble of a page has the tail toward the avatar, as in a chat app.
      const r = Math.min(b.h / 2, 18 * k), canto = primeira ? 4 * k : r;
      b.g.fillStyle(CONTORNO, 0.96).fillRoundedRect(0, 0, b.w, b.h, { tl: canto, tr: r, br: r, bl: r })
        .lineStyle(2 * k, 0xffffff, 0.85).strokeRoundedRect(0, 0, b.w, b.h, { tl: canto, tr: r, br: r, bl: r });
      if (primeira) b.g.fillStyle(CONTORNO, 0.96).fillTriangle(1 * k, 1 * k, -9 * k, 1 * k, 1 * k, 12 * k);
      y += b.h * b.s + 10 * k;
    });
    // "typing...": three dots in a small bubble where the next message will be.
    const pontos = [0, 1, 2].map((i) => this.add.circle(16 * k + i * 12 * k, 17 * k, 4 * k, 0xffffff));
    const digitando = this.add.container(bx, 0, [
      this.add.graphics().fillStyle(CONTORNO, 0.96).fillRoundedRect(0, 0, 56 * k, 34 * k, { tl: 4 * k, tr: 17 * k, br: 17 * k, bl: 17 * k }),
      ...pontos,
    ]).setVisible(false);
    pontos.forEach((d, i) => this.tweens.add({ targets: d, y: 11 * k, duration: 260, yoyo: true, repeat: -1, delay: i * 120, ease: 'Sine.easeInOut' }));
    // Page dots just under the screen: which page this is, and that there is more.
    const bolinhas = paginas.length > 1 ? paginas.map((_, i) =>
      this.add.circle(x0 + largura / 2 + (i - (paginas.length - 1) / 2) * 18 * k, tela.y + tela.h + 9 * k, 5 * k, 0xffffff, 0.4)) : [];
    borda();

    // Buttons centered in the footer; the main one is green (ENTER), the others slate.
    const alturaBt = Math.min(rodape.h, 48 * k), gap = 14 * k, tam = 19 * k;
    const montarBotoes = (lista: Botao[]) => {
      const larguras = lista.map((b) => {
        const t = this.make.text({ x: 0, y: 0, text: b.texto, style: letra(tam) }, false);
        const w = t.width + 2.2 * tam;
        t.destroy();
        return w;
      });
      let x = x0 + largura / 2 - (larguras.reduce((a, b) => a + b, 0) + gap * (lista.length - 1)) / 2;
      return lista.map((b, i) => {
        const bt = botaoVerde(this, x + larguras[i] / 2, rodape.y + rodape.h / 2, b.texto, tam, alturaBt, k, () => { tocarSfx('clique'); b.acao(); },
          { pulsar: false, pararPropagacao: true, animarHover: true, ...(b.principal ? {} : { cor: 0x475569 }) });
        x += larguras[i] + gap;
        return bt.setVisible(false);
      });
    };
    let pagina = 0;
    const seguinte: Botao = { texto: 'NEXT  ▶', acao: () => abrirPagina(pagina + 1), principal: true };
    const btsSeguinte = paginas.length > 1 ? montarBotoes([seguinte]) : [];
    const btsFinais = montarBotoes(botoes);

    // ----- the messages arrive -----
    const reduzido = movimentoReduzido();
    const mostrar = (i: number, animar: boolean) => {
      const { c, s } = bolhas[i];
      if (c.visible) return;
      c.setVisible(true);
      if (animar) {
        c.setScale(0.85 * s).setAlpha(0);
        this.tweens.add({ targets: c, scale: s, alpha: 1, duration: 220, ease: 'Back.easeOut' });
      }
    };
    const terminar = () => {
      this.timersChat.forEach((t) => t.remove());
      this.timersChat = [];
      digitando.setVisible(false);
      paginas[pagina].forEach((i) => mostrar(i, false));
      const ultima = pagina === paginas.length - 1;
      (ultima ? btsFinais : btsSeguinte).forEach((b) => {
        b.setVisible(true);
        if (!reduzido) { b.setAlpha(0); this.tweens.add({ targets: b, alpha: 1, duration: 250 }); }
      });
      this.acaoPrincipal = ultima ? botoes.find((b) => b.principal)?.acao : seguinte.acao;
      fundo.off('pointerdown');
    };
    const proxima = () => {
      const i = paginas[pagina].find((n) => !bolhas[n].c.visible);
      if (i === undefined) { terminar(); return; }
      // Typing time grows with the message, within limits.
      const espera = Phaser.Math.Clamp(itens[i].texto.length * 18, 450, 1100);
      digitando.setPosition(bx, bolhas[i].c.y).setVisible(true);
      this.timersChat.push(this.time.delayedCall(espera, () => {
        digitando.setVisible(false);
        mostrar(i, true);
        tocarSfx('bolha');
        this.timersChat.push(this.time.delayedCall(350, proxima));
      }));
    };
    const abrirPagina = (n: number) => {
      this.timersChat.forEach((t) => t.remove());
      this.timersChat = [];
      pagina = n;
      bolhas.forEach((b, i) => { if (!paginas[n].includes(i)) b.c.setVisible(false); });
      [...btsSeguinte, ...btsFinais].forEach((b) => b.setVisible(false));
      bolinhas.forEach((b, i) => b.setFillStyle(i === n ? 0xfde047 : 0xffffff, i === n ? 1 : 0.4));
      if (reduzido || opcoes.imediato) { terminar(); return; }
      this.acaoPrincipal = terminar;     // ENTER first shows the whole page
      fundo.off('pointerdown').on('pointerdown', terminar);
      this.timersChat.push(this.time.delayedCall(n === 0 ? 300 : 150, proxima));
    };
    abrirPagina(0);
    this.painel = this.children.list.slice(antes);
    this.children.bringToTop(this.btMenu);
  }
}
