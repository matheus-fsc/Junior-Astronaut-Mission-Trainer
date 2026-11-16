// Generated with AI assistance (Claude). See README, "Use of AI tools".
// The ground: real NASA terrain (Blender render), the crew's base (already built), the commander,
// and the cargo landers that bring new equipment. Players run the base, they do not build it:
// walk (or click), pick up the day's batteries at the Habitat, click a room to deliver one.
// Owns the ground camera and its zoom (sessao.u). When the flight to the Moon starts, the camera
// glides to the framing of the flight's first frame and the terrain dissolves into it (Espaco
// plays the frames) while the base stays visible, live.
import Phaser from 'phaser';
import { AstronautaEmJogo } from '../astronauta/emJogo';
import paletaLua from '../dados/paleta_lua.json';
import paletaMarte from '../dados/paleta_marte.json';
// Ground colors for dust, paths and the flag's shadow: set in create() for the current world.
const corDe = (h: string) => Number.parseInt(h.slice(1), 16);
let COR_SOLO_CLARO = corDe(String(paletaLua.solo[2][1]));
let COR_SOLO_MEDIO = corDe(String(paletaLua.solo[1][1]));
let COR_SOLO_SOMBRA = corDe(paletaLua.contorno);
import { Ambiente } from './ambiente';
import { configuracoesAbertas, movimentoReduzido, video, atualizarVideo } from '../video';
import { paraTela, paraChao, profundidade } from '../engine/iso';
import { passo, novoCorpo, G, G_LUA, G_MARTE, G_TERRA, pulo, type Corpo, type Caixa, type Entrada } from '../engine/fisica';
import { CicloPassada } from '../engine/passada';
import { encontrarCaminho, type Ponto } from '../engine/caminho';
import naveProps from '../dados/nave_props.json';
import { TIPOS, tipoOrientado, montarBasePadrao, montarLayout, ROTACAO_LAYOUT, BASE_MARTE, BASE_NAVE, SETORES_SUPRIMENTOS, type Construcao, type TipoId } from '../engine/construcao';
import { entregar as entregarRegra, custo, pronto, type Efeito } from '../regras';
import { caixaDaEntrega, empuxoDePouso, suprimentoDoDia, SUPRIMENTOS } from '../engine/suprimentos';
import { sortearEvento, eventoPorDemora, DOSE_ALARME, DEMORA_PASSO } from '../engine/eventos';
import { sessao, dadosTerreno, suave, sDeU, S_MAPA, fonte, ZOOM_MAX } from './sessao';
import { fundacao, sombraAstronauta } from './desenho';
import { VOO as voo } from './qualidade';
import { escolher } from '../tarefas';
import { criarIconeJogo, fundoRotulo, letra, rotuloMapa } from '../tarefas/estilo';
import type { DadosTarefa } from './Tarefa';
import modelos from '../dados/modulos.json';
import rotacoesModulos from '../dados/rotacoesModulos.json';
import { origemBaterias, modeloBancoBaterias } from '../engine/estacaoSolar';
import bandeiras from '../dados/bandeiras.json';
import sprite from '../dados/astronauta.json';
import { chaveSkin, chaveSkinSentado, chaveSkinCarga, SKIN_PADRAO, SKINS } from '../dados/skins';
import { LAYOUT } from '../dados/layout';
import { DECORACAO, DECORACAO_MARTE, OBJETOS_CONSTRUCAO, comoTipo, type DecoColocada } from '../dados/decoracao';
import { CHAVE_FOGUETE } from './Chegada';
import foguetevoo from '../dados/foguete_voo.json';
import { tocarMotor, tocarSfx, criarAmbienteSonoro } from '../sfx';
import { dirigirRover, desprenderRover, estacionarRover, desembarcar, pontoLivre, RAIO_ROVER } from '../engine/rover';
import { deveQuebrar } from '../paralama-tarefa';
import { criarCorridaEntrega, avancar, terminada, maisLonge, pontoLivrePerto, alvoDaSeta, pista, moverExpedicao, type Expedicao, type TipoExpedicao } from '../engine/expedicao';
import { criarExploracao, sortearTipo, AVISOS, type Contexto } from '../engine/exploracao';
import { sortearPremio, textoDoPremio, skinsDePremio, CHANCE_PREMIO_SALA, type Posse, type Premio, type TipoPremio } from '../engine/presentes';
import { salasComTarefaHoje } from '../engine/tarefasDoDia';
import { senhaDoEscudo, lugarDaSenha, EVENTO_SENHA } from '../engine/senha';
import { t } from '../idioma';
import { ACESSORIOS, acessorioPorId, chaveAcessorio } from '../dados/acessorios';
import { ganharAcessorio, acessoriosGanhos, ganharSkin, skinsGanhas, dicaDeTrocaVista, marcarDicaDeTroca, temNovidade, marcarNovidade } from '../acessorios';
import { CORES_BASE, corPorId, proximaCor, multiplicarTom } from '../dados/cores';
import { coresGanhas, corDoModulo, ganharCor, pintarModulo, dicaDeTintaVista, marcarDicaDeTinta } from '../cores';
import { ESTACOES, estacaoDisponivel, textoEstacao, estacaoDoModulo, chaveModulo, itemDaEstacao, type Estacao } from '../engine/estacoes';
import { desenharRover, direcaoRover, esconderRover, saltoRover, LINHA_QUADRIL_SENTADO, type PecasRover } from './desenharRover';
import { controleMovel, consumirPuloMovel, dispositivoMovel } from '../mobile';

const P = dadosTerreno.imagem;
// Mars: warm light on the props and modules (they are rendered under the Moon's light), and the props that make sense in Jezero crater, with
// their Mars names. Real: Perseverance's sky crane crashed near its landing site, and it left
// sample tubes on the crater floor for a future mission to bring back.
const TOM_MARTE = 0xffdcc4;

// Energy tasks, played when picking up the day's batteries. The long-shadow one only makes sense on the Moon.
const ENERGIA = ['PaineisSolaresTarefa', 'DesviarEnergiaTarefa', 'SeguirSolTarefa', 'ReatorTarefa'];
const ENERGIA_LUA = [...ENERGIA, 'ForaDaSombraTarefa'];
let ultimaEnergia = '';
const BONUS_CONSERTO = 1;     // batteries the crew gives for fixing an event
const ALCANCE = 1.3;          // tiles from a module's edge to use it
const ESCALA_MARCADOR = 0.62; // Compact destination marker; keep the source emblem crisp.
const PROFUNDIDADE_MARCADOR = 900_000; // Above world objects, below room labels and the HUD.
const ALTURA_POUSO = 14;      // tiles at character scale (about 50 m): where the lander appears
type Modelo = keyof typeof modelos;
// Every module picture: the team's (modulos.json) and the ship's (nave_props.json, make_nave.py).
// `pegada` is the footprint a picture was drawn for, when it differs from the module's own.
type Quadro = { w: number; h: number; ancora: number[]; escala: number; pegada?: number[] };
const QUADROS = { ...modelos, ...naveProps, ...rotacoesModulos } as unknown as Record<string, Quadro>;
export type ObjetoEditor = Construcao & {deco?: DecoColocada};
const PEGADA_MODELO: Record<string, [number, number]> = { pouso: [2, 2], reciclador: [2, 2] };
// Ship props (chapter 2): each one has a fixed spot in a zone that makes sense (offsets in tiles from
// the grid center, 12; the deck is gx 3..20, gy 6..17; gy 6 is the far wall with the portholes, gy 17
// the cut-away side toward the camera, gx 3 the engines). The corridor (gy 10..12) stays clear.
//   tail, front: the crew's bedroom (bunks side by side, water tanks that shield the sleepers)
//   tail, far corner: cargo bags behind the Engines room
//   middle, front: the galley (the table on its own, the veggie garden a tile away)
//   far wall: the water recycler next to Life Support, the window
//   nose: the cockpit with the radio beside it and the flame experiment behind it
//   nose, front: health corner (treadmill and medical kit)
// Zones keep at least one free tile between them so each one reads as its own room.
// If a spot is taken, the prop falls back to the nearest free one (Grade.procurarComEspaco).
const DECO_NAVE = [
  { id: 'nave_beliche', info: 'In space you grow a little taller, because your back stretches out!', nome: 'Crew Bunks', w: 2, h: 1, altura: 1.6, dx: -9, dy: 2 },
  { id: 'nave_beliche', info: 'In space you grow a little taller, because your back stretches out!', nome: 'Crew Bunks', w: 2, h: 1, altura: 1.6, dx: -9, dy: 4 },
  { id: 'nave_agua', info: 'Water tanks. Water is also a good shield against radiation, so tanks often line the walls.', nome: 'Water Tanks', w: 1, h: 1, altura: 1.2, dx: -7, dy: 2 },
  { id: 'nave_medico', info: 'Close your eyes in space and you may see tiny flashes of light!', nome: 'Medical Kit', w: 1, h: 1, altura: 1.3, dx: 8, dy: 4 },
  { id: 'nave_bolsas', info: 'Soft cargo bags hold spare parts, clothes and food for the long trip.', nome: 'Cargo Bags', w: 1, h: 1, altura: 0.9, dx: -9, dy: -5 },
  { id: 'nave_mesa', info: 'In space, tears do not fall. They stick to your eyes like little bubbles!', nome: 'Galley', w: 2, h: 2, altura: 1.1, dx: 1, dy: 2 },
  { id: 'nave_reciclador', info: "Astronauts' pee is cleaned and turned into drinking water. Yes, really!", nome: 'Water Recycler', w: 1, h: 1, altura: 1.2, dx: 1, dy: -6 },
  { id: 'nave_plantas', info: 'A small veggie garden. Astronauts on the Space Station have grown and eaten lettuce in space.', nome: 'Veggie Garden', w: 1, h: 1, altura: 1.1, dx: 4, dy: 2 },
  { id: 'nave_esteira', info: 'Astronauts run every day, held down by bungee cords, to keep their bones and muscles strong.', nome: 'Treadmill', w: 2, h: 1, altura: 1.15, dx: 5, dy: 4 },
  { id: 'nave_janela', info: 'A car would need more than 60 years to drive to Mars. Our ship takes about 7 months!', nome: 'Window', w: 1, h: 1, altura: 1.35, dx: 3, dy: -6 },
  { id: 'nave_chama', info: 'With no gravity, a flame is round like a ball, not pointy!', nome: 'Flame Test', w: 1, h: 1, altura: 1.5, dx: 7, dy: -6 },
  { id: 'nave_cockpit', info: 'Where the pilots steer the ship. On the way to Mars the computer does most of the flying.', nome: 'Cockpit', w: 2, h: 1, altura: 1.1, dx: 7, dy: -3 },
  { id: 'nave_radio', info: 'Hello, Earth! A message can take 20 minutes to get there. No quick chats!', nome: 'Radio', w: 1, h: 1, altura: 1.4, dx: 5, dy: -3 },
];

// Fly-bys on the ship (chapter 2): little jokes that cross the screen now and then, each with a true fact.
// The pictures come from tools/lua3d/make_modules.py (passa_*), loaded as mod_<id> like every module.
const PASSANTES = [
  { id: 'passa_ovni', cor: '#86efac', texto: '👽 A tiny flying saucer! Just kidding: nobody has ever found aliens. But we are still looking!' },
  { id: 'passa_pato', cor: '#fde047', texto: '🦆 A rubber duck, floating in space! With no air to stop it, anything you let go of keeps drifting.' },
  { id: 'passa_cometa', cor: '#93c5fd', texto: '☄️ A smiling comet! Comets are balls of ice and dust. Near the Sun they grow a long glowing tail.' },
];
const PASSANTE_ESCALA = 0.65;   // on screen, in pixels per picture pixel (the pictures are drawn at 2x)
const PASSANTE_DURACAO = 11;    // seconds to cross the screen

// A cargo lander bringing one piece of equipment (see engine/suprimentos.ts).
type Pouso = {
  tipo: TipoId; gx: number; gy: number;        // footprint corner of the equipment it brings
  z: number; vz: number; chao: number;         // lander height, speed (tiles, tiles/s), ground
  fase: 'descendo' | 'pousado' | 'subindo'; t: number; empuxo: number;
  img: Phaser.GameObjects.Image; chama: Phaser.GameObjects.Image; sombra: Phaser.GameObjects.Ellipse;
};

export class Superficie extends Phaser.Scene {
  private setaEmergencia!: Phaser.GameObjects.Container;
  private ponteiroEmergencia!: Phaser.GameObjects.Container;
  private contornoEmergencia!: Phaser.GameObjects.Graphics;
  private larguraPlacaEmergencia = 0;
  private alturaPlacaEmergencia = 0;
  private tempoEfeitos = 0;
  private ambiente!: Ambiente;
  private readonly controlesObservados = new Set<'movimento' | 'pulo'>();
  private readonly limitesOclusao = new Phaser.Geom.Rectangle();
  private corpo!: Corpo;
  private astronautaProcedural!: AstronautaEmJogo;
  private dtAstronauta=0;
  private gCaminhos!: Phaser.GameObjects.Graphics;
  private gAstronauta!: Phaser.GameObjects.Graphics;   // ground shadow; inventory and carried item have their own objects
  private comandante!: Phaser.GameObjects.Sprite;
  private acessoriosSprites: Phaser.GameObjects.Sprite[] = [];   // face, glasses and hat sheets drawn over the astronaut
  private cargaHud!: Phaser.GameObjects.Container;
  private cargaFundo!: Phaser.GameObjects.Graphics;
  private cargaTexto!: Phaser.GameObjects.Text;
  private ultimaCarga = -1;
  private cargaMudou = -1e9;
  private sombraBandeira!: Phaser.GameObjects.Graphics;
  private mascaraBandeira!: Phaser.GameObjects.Graphics;
  private bandeira!: Phaser.GameObjects.Image;         // flag marking the chosen destination
  private direcao = 1;                                  // sprite row: map angle / 45 deg
  private desenhos = new Map<number, { g: Phaser.GameObjects.Graphics; img: Phaser.GameObjects.Image; rotulo?: Phaser.GameObjects.Text }>();
  private rota: Ponto[] = [];                            // A* waypoints to walk through
  private alvoUsar: Construcao | null = null;             // module to use when we arrive
  private bloqueadoCont = 0;
  private destinoRota: { gx: number; gy: number } | null = null;   // the flag's spot, to re-plan when stuck
  private proximoPassante = 25 + Math.random() * 35;   // seconds until the next ship fly-by
  private passante: { img: Phaser.GameObjects.Image; t: number; fy: number } | null = null;
  private teclas!: Record<string, Phaser.Input.Keyboard.Key>;
  private readonly passada = new CicloPassada(sprite.andar);
  private quadroPassada = 0;
  private sobre: Construcao | null = null;              // module under the cursor
  private seguir = true;             // camera follows the commander until the player pans
  private arrastando = false;
  private apertouNoMapa = false;
  private mapa!: Phaser.GameObjects.Layer;          // terrain + everything on it
  private terreno!: Phaser.GameObjects.Image;
  private inicioVoo: { x: number; y: number } | null = null;
  private pouso: Pouso | null = null;
  private gRover!: Phaser.GameObjects.Graphics;
  private bandeirasExp: Phaser.GameObjects.Container[] = [];   // flags of the current expedition
  private chaveExp = '';
  private avisoAPe = 0;
  private bloqueioExp = 0;      // seconds before a closed expedition task may open again
  private proxBip = 0;          // seconds until the next hot/cold beep
  private pecasRover!: PecasRover;
  private dicaRover!: Phaser.GameObjects.Text;
  private fundoDicaRover!: Phaser.GameObjects.Graphics;
  private fundoDica?: Phaser.GameObjects.Graphics;
  private alvoRover = false;
  private sons!: ReturnType<typeof criarAmbienteSonoro>;
  private progressoAnterior = 0;
  private suprimentosPendentes: TipoId[] = [];
  // Rocket leaving the Moon at the end of chapter 1 (decolar). The pad then shows no rocket.
  private decolagem: { img: Phaser.GameObjects.Image; chama: Phaser.GameObjects.Graphics; cx: number; cy: number; z: number; vz: number; t: number; fim: () => void } | null = null;
  private foguetePartiu = false;
  // The ship (chapter 2): the closed ship, roof on, over everything when zoomed out; the
  // cutaway deck when close. Names on the map fade out under the roof.
  private teto: Phaser.GameObjects.Image | null = null;
  private plumas: Phaser.GameObjects.Container | null = null;   // cached Hall-thruster images
  private nomesNoMapa: Phaser.GameObjects.Text[] = [];
  private decoVisuais: { d: DecoColocada; img: Phaser.GameObjects.Image }[] = [];
  private marcasEstacao: { d: DecoColocada; c: Phaser.GameObjects.Container }[] = [];   // "!" over ship stations
  private marcasEquip = new Map<number, Phaser.GameObjects.Container>();   // "!" over equipment stations, by module id
  private senhaNoChao: Phaser.GameObjects.Container | null = null;          // the Shield's door code painted on the ground (day-2 alarm)
  private marcaGuardaroupa: Phaser.GameObjects.Container | null = null;      // shirt icon over the Habitat when a new item waits
  private marcasSala = new Map<number, Phaser.GameObjects.Container>();    // blue "!" over the rooms with a task today
  private dica?: Phaser.GameObjects.Text;                // shared prop tooltip
  private decoSobre: DecoColocada | null = null;         // prop under the cursor
  private decoFixa: DecoColocada | null = null;          // prop just tapped (touch): tooltip stays a few seconds
  private decoFixaT = 0;

  constructor() {
    super({ key: 'Superficie' });   // started by Carregar
  }

  // The ship's solar electric propulsion: Hall thrusters fire for months on end with a faint
  // blue glow (ionized xenon). Each plume points back along -gx from its exit (make_nave.py
  // 'propulsores'): a bright core and a wide soft glow that fade with distance, gently pulsing.
  private desenharPlumas() {
    const g = this.plumas;
    if (!g) return;
    const lista = (dadosTerreno as unknown as { propulsores?: { x: number; y: number; z: number; r: number }[] }).propulsores ?? [];
    const t = this.time.now / 1000;
    const mexe = !movimentoReduzido() && video.efeitos;
    const px = Math.hypot(P.ex[0], P.ex[1]);           // screen px per tile step, about 33
    lista.forEach((m, i) => {
      const pulso = mexe ? 0.85 + 0.15 * Math.sin(t * 9 + i * 1.7) + 0.05 * Math.sin(t * 23 + i) : 1;
      let img = g.list[i] as Phaser.GameObjects.Image | undefined;
      if (!img) {
        const chave = `pluma_nave_${m.r}`;
        if (!this.textures.exists(chave)) {
          const textura = this.textures.createCanvas(chave, 320, 208)!, ctx = textura.getContext();
          // Additive blending also inside the baked texture preserves overlapping light.
          ctx.globalCompositeOperation = 'lighter';
          for (let k = 14; k >= 0; k--) {
            const d = k * 0.55;                                  // tiles back from the exit
            const x = 288 - d * P.ex[0], y = 176 - d * P.ex[1];
            const f = 1 - k / 15;
            const r = m.r * px * (1 + d * 0.22);
            const circulo = (raio: number, cor: string, alpha: number) => {
              ctx.globalAlpha = alpha; ctx.fillStyle = cor; ctx.beginPath(); ctx.arc(x, y, raio, 0, Math.PI * 2); ctx.fill();
            };
            circulo(r * 1.9, '#38bdf8', 0.10 * f);
            circulo(r, '#7dd3fc', 0.22 * f * f);
            if (k < 6) circulo(r * 0.45, '#e0f2fe', 0.5 * (1 - k / 6));
          }
          textura.refresh();
        }
        const p = paraTela(P, m.x, m.y, m.z);
        img = this.add.image(p.x - 288, p.y - 176, chave).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
        g.add(img);
      }
      img.setAlpha(pulso);
    });
  }

  // The destination flag: the world's own, and on the ship Earth's (the home the crew left).
  private get planetaBandeira(): 'lua' | 'marte' | 'terra' { return sessao.mundo === 'nave' ? 'terra' : sessao.mundo; }

  // A module's name: the chapter names its rooms (capitulos.ts); on Mars the Habitat is the
  // lander, on the ship the Battery Bank is the Power Room.
  private nomeDe(c: Construcao) {
    if (sessao.mundo === 'marte' && c.tipo.id === 'habitat') return 'Lander';
    if (sessao.mundo === 'nave' && c.tipo.id === 'bateria') return 'Power Room';
    return (c.tipo.sala && sessao.cap.salas.find((sl) => sl.efeito === c.tipo.sala)?.nome) || c.tipo.nome;
  }
  // Whether the player already walked / jumped (read by the on-map guide, guia.ts).
  jaUsou(c: 'movimento' | 'pulo') { return this.controlesObservados.has(c); }

  objetosParaEditor(): ObjetoEditor[] {
    return [...sessao.grade.lista,...sessao.grade.deco.map((d,i)=>({id:-(i+1),deco:d,gx:d.gx,gy:d.gy,z:d.z,rotacao:d.rotacao??0,
      tipo:{id:'habitat' as const,nome:d.nome,w:d.w,h:d.h,altura:d.altura,unico:false,cor:0,papel:d.info}}))];
  }

  dadosParaEditor(c: ObjetoEditor) {
    if(c.deco){const v=this.decoVisuais.find(v=>v.d===c.deco);return v?{imagem:v.img,nome:c.deco.nome}:null;}
    const desenho=this.desenhos.get(c.id);
    return desenho?{imagem:desenho.img,nome:this.nomeDe(c)}:null;
  }

  prepararEditor() {
    this.rota=[];this.alvoUsar=null;this.alvoRover=false;this.seguir=false;this.recolherBandeira();
    this.dica?.setVisible(false);this.decoSobre=null;this.decoFixa=null;this.decoFixaT=0;
    this.corpo.vx=this.corpo.vy=0;
  }

  posicionarPreviaEditor(img: Phaser.GameObjects.Image,c: ObjetoEditor,gx:number,gy:number,rotacao:number) {
    if(c.deco){const d=c.deco,dim=(rotacao%2)!==((d.rotacao??0)%2)?{w:d.h,h:d.w}:{w:d.w,h:d.h};
      this.posicionarDeco(img,{...d,...dim,gx,gy,rotacao,z:sessao.terreno.alturaMax(gx,gy,dim.w,dim.h)+0.01});return;}
    const tipo=tipoOrientado(c.tipo,rotacao);
    this.posicionar(img,{...c,tipo,gx,gy,rotacao,z:sessao.terreno.alturaMax(gx,gy,tipo.w,tipo.h)+0.025},this.modelo(c));
  }

  concluirMovimentoEditor(c: ObjetoEditor) {
    this.rota=[];this.alvoUsar=null;this.alvoRover=false;this.seguir=false;this.recolherBandeira();
    if(c.deco){const d=c.deco;let v=this.decoVisuais.find(v=>v.d===d);
      if(!v){const img=this.add.image(0,0,'mod_habitat');this.mapa.add(img);if(sessao.mundo==='marte')img.setTint(TOM_MARTE);v={d,img};this.decoVisuais.push(v);}
      this.posicionarDeco(v.img,d);
      Object.assign(c,{gx:d.gx,gy:d.gy,z:d.z,rotacao:d.rotacao,tipo:{...c.tipo,w:d.w,h:d.h}});
    }else this.desenharModulo(c);
    this.desenharCaminhos();
    // Layout edits change no resources: avoid redrawing every module via the state bus.
    return sessao.salvar();
  }

  removerCopiaEditor(c:ObjetoEditor) {
    if(c.deco){const i=this.decoVisuais.findIndex(v=>v.d===c.deco);if(i>=0){this.decoVisuais[i].img.destroy();this.decoVisuais.splice(i,1);}}
    else {const d=this.desenhos.get(c.id);if(d){d.g.destroy();d.img.destroy();d.rotulo?.destroy();this.nomesNoMapa=this.nomesNoMapa.filter(t=>t!==d.rotulo);this.desenhos.delete(c.id);}}
    this.dica?.setVisible(false);this.decoSobre=null;this.decoFixa=null;
    this.rota=[];this.alvoUsar=null;this.desenharCaminhos();return sessao.salvar();
  }

  // Map center in world px: the flight's first frame is centered on it.
  private get centroMapa() {
    const h = dadosTerreno.n / 2;
    return paraTela(P, h, h, sessao.terreno.altura(h, h));
  }

  create() {
    this.foguetePartiu=false;
    this.decolagem=null;
    // Scene inspection is available in development or explicitly opted-in benchmark builds.
    if (import.meta.env.DEV || import.meta.env.VITE_MEDIR === '1') Object.assign(window, { superficie: this, sessao });
    this.controlesObservados.clear();   // a NEW GAME restarts this scene: the guide asks to walk and jump again
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    this.desenhos.clear();
    this.pouso = null;
    this.tempoEfeitos = 0;
    this.mapa = this.add.layer().setDepth(0);
    // A warning sign (badge + big arrow). The whole sign bounces and the red outline blinks.
    const rotuloEmergencia = this.add.text(0, 0, 'RADIATION SHIELD', {
      fontFamily: 'Fredoka, sans-serif', fontSize: '19px', fontStyle: 'bold',
      color: '#ffd93b', stroke: '#14243e', strokeThickness: 4, align: 'center',
    }).setOrigin(0, 0.5);
    const tamanhoIcone = 26, gapIcone = 9, padX = 15, padY = 8;
    const larguraPlaca = padX * 2 + tamanhoIcone + gapIcone + rotuloEmergencia.width;
    const alturaPlaca = Math.max(rotuloEmergencia.height, tamanhoIcone) + padY * 2;
    this.larguraPlacaEmergencia = larguraPlaca;
    this.alturaPlacaEmergencia = alturaPlaca;
    const cyPlaca = -Math.round(alturaPlaca / 2);
    const placa = this.add.graphics()
      .fillStyle(0x14243e, 0.98).fillRoundedRect(-larguraPlaca / 2, -alturaPlaca, larguraPlaca, alturaPlaca, Math.round(alturaPlaca / 2))
      .lineStyle(3, 0xffd93b, 1).strokeRoundedRect(-larguraPlaca / 2, -alturaPlaca, larguraPlaca, alturaPlaca, Math.round(alturaPlaca / 2));
    const iconeEmergencia = criarIconeJogo(this, -larguraPlaca / 2 + padX + tamanhoIcone / 2, cyPlaca, 'radiation', tamanhoIcone);
    rotuloEmergencia.setPosition(-larguraPlaca / 2 + padX + tamanhoIcone + gapIcone, cyPlaca);
    const pontosSeta = [{ x: -9, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 17 },
      { x: 22, y: 17 }, { x: 0, y: 40 }, { x: -22, y: 17 }, { x: -9, y: 17 }];
    const sombraSeta = this.add.graphics().fillStyle(0x0b1a4a, 0.3)
      .fillPoints(pontosSeta.map((p) => ({ x: p.x + 2, y: p.y + 3 })), true);
    // Soft red halo behind the arrow (it pulses like a warning light instead of a hard red outline).
    this.contornoEmergencia = this.add.graphics().lineStyle(9, 0xff2020, 1)
      .strokePoints(pontosSeta, true).setScale(1.05).setAlpha(0.35);
    const miolo = this.add.graphics().fillStyle(0xffd93b).fillPoints(pontosSeta, true);
    const realce = this.add.graphics().fillStyle(0xfff4b0, 0.95).fillTriangle(-7, 4, 7, 4, 0, 30);
    const bordaSeta = this.add.graphics().lineStyle(4, 0x14243e, 1).strokePoints(pontosSeta, true);
    this.ponteiroEmergencia = this.add.container(0, 12, [this.contornoEmergencia, sombraSeta, miolo, realce, bordaSeta]);
    this.setaEmergencia = this.add.container(0, 0, [placa, iconeEmergencia, rotuloEmergencia, this.ponteiroEmergencia])
      .setDepth(2_000_000).setVisible(false);
    this.mapa.add(this.setaEmergencia);
    const marte = sessao.mundo === 'marte';
    const pal = marte ? paletaMarte : paletaLua;
    COR_SOLO_CLARO = corDe(String(pal.solo[2][1])); COR_SOLO_MEDIO = corDe(String(pal.solo[1][1])); COR_SOLO_SOMBRA = corDe(pal.contorno);
    const nave = sessao.mundo === 'nave';
    this.terreno = this.add.image(0, 0, marte ? 'terreno_marte' : nave ? 'terreno_nave' : 'terreno').setOrigin(0).setDepth(-1e6);
    this.nomesNoMapa = [];
    this.teto = nave && this.textures.exists('terreno_nave_teto')
      ? this.add.image(0, 0, 'terreno_nave_teto').setOrigin(0).setDepth(1.5e6).setAlpha(0) : null;
    this.mapa.add(this.terreno);
    if (this.teto) this.mapa.add(this.teto);
    // Behind the ship's picture: its structure covers the plumes where it should.
    this.plumas = nave ? this.add.container(0, 0).setDepth(-1.1e6) : null;
    if (this.plumas) this.mapa.add(this.plumas);
    this.gCaminhos = this.add.graphics().setDepth(-900_000);
    this.mapa.add(this.gCaminhos);
    this.ambiente = new Ambiente(this,this.mapa,P,sessao.terreno,sessao.mundo);

    // The crew's base is already there, where the layout editor put it (LAYOUT; without one, the
    // planner in engine/construcao.ts). On Mars only the lander and the panels are; the rooms are
    // construction sites.
    if (!sessao.grade.lista.length) {
      const plano = LAYOUT[sessao.mundo]?.modulos;
      if (plano?.length) montarLayout(sessao.grade, plano);
      else montarBasePadrao(sessao.grade, marte ? BASE_MARTE : nave ? BASE_NAVE : undefined);
    }
    // Labels and construction sites follow the rules state.
    sessao.ouvir(this, 'estado', () => { for (const c of sessao.grade.lista) if (c.tipo.sala || c.tipo.id === 'bateria') this.desenharModulo(c); });
    // The commander starts by the Habitat, or by the Power Room on the ship.
    const hab = sessao.grade.lista.find((c) => c.tipo.id === 'habitat') ?? sessao.grade.lista.find((c) => c.tipo.id === origemBaterias(sessao.mundo))!;
    const sx = hab.gx + hab.tipo.w + 0.7, sy = hab.gy + hab.tipo.h / 2;
    this.corpo = novoCorpo(sx, sy, sessao.terreno.altura(sx, sy));
    this.corpo.noChao = true;

    this.gAstronauta = this.add.graphics();
    this.astronautaProcedural = new AstronautaEmJogo(this);
    this.comandante = this.add.sprite(0, 0, chaveSkin(this.skinAtiva()), 0).setOrigin(sprite.pe[0] / sprite.frame, sprite.pe[1] / sprite.frame)
      .setScale(sprite.escala);
    // Face, glasses, hat: three overlay sheets in that order, over the astronaut (dados/acessorios.ts).
    this.acessoriosSprites = [0, 1, 2].map(() => this.add.sprite(0, 0, '__DEFAULT', 0).setOrigin(sprite.pe[0] / sprite.frame, sprite.pe[1] / sprite.frame)
      .setScale(sprite.escala).setVisible(false));
    this.cargaFundo=this.add.graphics();
    this.cargaTexto=this.add.text(0,0,'',fonte(15,'#ffffff',{fontStyle:'bold',stroke:'#0b1a4a',strokeThickness:2})).setOrigin(0.5);
    this.cargaHud=this.add.container(0,0,[this.cargaFundo,this.cargaTexto]).setVisible(false);
    this.ultimaCarga=-1; this.cargaMudou=-1e9;
    this.mapa.add(this.cargaHud);
    const bInfo = bandeiras[this.planetaBandeira];
    this.bandeira = this.add.image(0, 0, `bandeira_${this.planetaBandeira}`)
      .setOrigin(bInfo.ancora[0] / bInfo.w, bInfo.ancora[1] / bInfo.h)
      .setScale(bInfo.escala * ESCALA_MARCADOR)
      .setVisible(false);
    this.sombraBandeira = this.add.graphics().setDepth(PROFUNDIDADE_MARCADOR-1).setVisible(false);
    this.mascaraBandeira = this.make.graphics({},false);
    this.bandeira.setMask(this.mascaraBandeira.createGeometryMask());
    this.events.once('shutdown',()=>{this.bandeira.clearMask(true);this.mascaraBandeira.destroy();});
    this.mapa.add([this.gAstronauta, this.comandante, ...this.acessoriosSprites, this.sombraBandeira, this.bandeira]);
    for (const c of sessao.grade.lista) this.desenharModulo(c);
    this.montarDeco();
    this.desenharCaminhos();
    if (sessao.posicaoAstronauta && sessao.posicaoAstronauta.x<sessao.terreno.n && sessao.posicaoAstronauta.y<sessao.terreno.n) this.corpo={...sessao.posicaoAstronauta};
    this.rota = []; this.alvoUsar = null; this.alvoRover = false;
    // The rover drives on the Moon and on Mars (the same LRV, dusty red there); not inside the ship.
    if (sessao.mundo !== 'nave') sessao.rover ??= estacionarRover(sessao.terreno, this.caixasDeColisao(), sx + 1, sy + 1);
    if (sessao.rover?.dirigindo) this.corpo = sessao.rover.corpo;
    sessao.posicaoAstronauta=this.corpo;
    this.progressoAnterior=sessao.progressoFoguete;
    this.suprimentosPendentes=sessao.mundo==='lua' && sessao.fase==='dia'
      ? SUPRIMENTOS.filter(s=>s.dia<=sessao.estado.dia && !sessao.grade.lista.some(c=>c.tipo.id===s.tipo)).map(s=>s.tipo):[];
    this.sons=criarAmbienteSonoro();
    this.passada.reiniciar();
    this.quadroPassada = 0;
    const silenciar=()=>{this.sons.silenciar();this.passada.reiniciar();};
    const visibilidade=()=>{if(document.hidden)silenciar();};
    this.events.on('pause',silenciar);
    document.addEventListener('visibilitychange',visibilidade);
    this.events.once('shutdown',()=>{
      this.sons.parar();this.events.off('pause',silenciar);document.removeEventListener('visibilitychange',visibilidade);
      sessao.abastecendoRover=false;
    });
    this.gRover = this.add.graphics();
    this.pecasRover = {
      sombra: this.add.ellipse(0, 0, 67, 28, 0x111827, 0.28).setVisible(false),
      corpo: this.add.image(0, 0, 'lrv_0').setVisible(false),
      frente: this.add.image(0, 0, 'lrv_frente_0').setVisible(false),
      poeira: this.add.graphics(),
    };
    this.mapa.add(this.pecasRover.poeira!);
    if (sessao.mundo === 'marte') { this.pecasRover.corpo.setTint(TOM_MARTE); this.pecasRover.frente.setTint(TOM_MARTE); }
    this.dicaRover = this.add.text(0, 0, '', letra(13, '#ffffff', {
      padding: { x: 12, y: 6 }, align: 'center',
    })).setOrigin(0.5, 1).setDepth(1_000_001).setInteractive({ useHandCursor: true });
    this.fundoDicaRover = this.add.graphics();
    this.dicaRover.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      if (!this.podeUsarRover()) return;
      if (sessao.rover?.dirigindo || this.pertoRover()) this.alternarRover();
      else this.caminharAoRover();
    });
    this.mapa.add([this.pecasRover.sombra, this.pecasRover.corpo, this.gRover, this.pecasRover.frente, this.fundoDicaRover, this.dicaRover]);

    const pe = paraTela(P, this.corpo.x, this.corpo.y, this.corpo.z);
    this.cameras.main.centerOn(pe.x, pe.y);

    // ---- input: keys walk; drag pans; a tap walks there, or to a room and uses it ----
    const kb = this.input.keyboard!;
    this.teclas = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,E') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-E', (ev: KeyboardEvent) => { if (!ev.repeat) this.usarPerto(); });
    kb.on('keydown-C', (ev: KeyboardEvent) => { if (!ev.repeat) this.alternarPintura(); });
    this.arrastando = false;
    this.apertouNoMapa = false;
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      const q = paraChao(P, sessao.terreno, ptr.worldX, ptr.worldY);
      this.destacar(q ? sessao.grade.em(q.gx, q.gy) ?? null : null);
      this.decoSobre = this.decoEm(ptr.worldX, ptr.worldY);
      if (!ptr.isDown || !this.apertouNoMapa || this.input.pointer2.isDown) return;
      if (!this.arrastando && Phaser.Math.Distance.Between(ptr.downX, ptr.downY, ptr.x, ptr.y) < 8) return;
      this.arrastando = true;
      this.seguir = false;
      const cam = this.cameras.main;
      cam.scrollX -= (ptr.x - ptr.prevPosition.x) / cam.zoom;
      cam.scrollY -= (ptr.y - ptr.prevPosition.y) / cam.zoom;
    });
    // A press on a panel button (Interface, Tarefa) never reaches this scene, but the panel closes on
    // that press, so the release does. Only a release whose press was on the map is a click.
    this.input.on('pointerdown', () => { this.arrastando = false; this.apertouNoMapa = true; });
    this.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      if (this.apertouNoMapa && !this.arrastando && !this.input.pointer2.isDown && ptr.button === 0) this.clicar(ptr);
      this.arrastando = false;
      this.apertouNoMapa = false;
    });
    this.input.mouse?.disableContextMenu();

    sessao.ouvir(this, 'estado', () => { for (const c of sessao.grade.lista) this.desenharModulo(c); this.animarMontagem(); });
    // A new phase can change a picture too: the shield's water walls drain for the next morning.
    sessao.ouvir(this, 'fase', () => { for (const c of sessao.grade.lista) this.desenharModulo(c); });
    sessao.ouvir(this, 'suprimento', (tipo) => this.chegar(tipo));
    sessao.ouvir(this, 'pousoFoguete', (fim) => this.pousarFoguete(fim));
  }

  // ---------- zoom ----------
  private aplicarZoom() {
    const s = sDeU(sessao.u);
    const cam = this.cameras.main;

    // Ground: keep the point under the cursor / pinch still (Clash of Clans style).
    const a = sessao.ancora;
    const antes = a && !sessao.voo && sessao.vista === 'chao' ? cam.getWorldPoint(a.x, a.y) : null;
    cam.setZoom(s / S_MAPA);
    if (antes && a) {
      cam.preRender();
      const depois = cam.getWorldPoint(a.x, a.y);
      cam.scrollX += antes.x - depois.x; cam.scrollY += antes.y - depois.y;
      this.seguir = false;
    }

    // Flight: glide to the map center (the first frame's center). Then the terrain picture
    // dissolves into the flight frames, but the base (modules, commander, lander) stays, live,
    // shrinking with the frames while the camera only backs away (p < 0.3, same view angle);
    // past that the planet turns and Espaco marks the base with a light instead.
    const v = sessao.voo;
    const mc = this.centroMapa;
    this.terreno.setAlpha(1);
    if (v?.tipo === 'filme') {
      if (!this.inicioVoo) this.inicioVoo = { x: cam.midPoint.x, y: cam.midPoint.y };
      // The glide to the map center follows the zoom of the same motion (already eased as a whole).
      const k = v.fase === 'prep' && v.sentido > 0 ? v.t : 1;
      cam.centerOn(Phaser.Math.Linear(this.inicioVoo.x, mc.x, k), Phaser.Math.Linear(this.inicioVoo.y, mc.y, k));
      const q = sessao.quadroFilme;
      if (q !== null) {
        cam.setZoom((sDeU(sessao.uFilme) * Math.pow(voo.razao, -q)) / S_MAPA);
        // The map picture (the cut-out piece with its edges) fades out early and slowly, while the
        // film fades in under it. Kept opaque longer it sat over the film's ground not quite in
        // step with it, and seemed to pulse a few times before vanishing at once.
        this.terreno.setAlpha(1 - suave(0.004, 0.05, q));
      }
      this.mapa.setAlpha(q === null ? 1 : 1 - suave(0.22, 0.32, q));
    } else {
      this.inicioVoo = null;
      this.mapa.setAlpha(sessao.vista === 'chao' ? 1 : 0);
    }
    if (sessao.vista !== 'chao' || sessao.voo) this.recolherBandeira();
    this.mapa.setVisible(this.mapa.alpha > 0.001);
    this.input.enabled = sessao.vista === 'chao' && !sessao.voo && !sessao.emTarefa && !sessao.abastecendoRover && !configuracoesAbertas && !sessao.transicao;
  }

  // ---------- input ----------
  private clicar(ptr: Phaser.Input.Pointer) {
    if (!this.podeUsarRover()) return;
    if (this.pintando) { this.pintarClique(ptr); return; }
    const r = sessao.rover;
    if (r) {
      const p = paraTela(P, r.corpo.x, r.corpo.y, r.corpo.z);
      if (Math.abs(ptr.worldX - p.x) < 42 && Math.abs(ptr.worldY - (p.y - 15)) < 32) {
        if (r.dirigindo || this.pertoRover()) this.alternarRover();
        else this.caminharAoRover();
        return;
      }
    }
    this.alvoRover = false;
    // Tapping a prop (touch has no hover) shows what it is for a few seconds.
    const deco = this.decoEm(ptr.worldX, ptr.worldY);
    if (deco) {
      if (ESTACOES[deco.id] && this.pertoDeco(deco) <= ALCANCE) { this.usarEstacao(deco); return; }
      this.decoFixa = deco; this.decoFixaT = 4; return;
    }
    const q = paraChao(P, sessao.terreno, ptr.worldX, ptr.worldY);
    if (!q) return;
    this.seguir = true;
    const c = r?.dirigindo ? undefined : sessao.grade.em(q.gx, q.gy);
    // If clicking a module we are already standing next to, use it immediately.
    if (c && this.perto(c)) {
      this.rota = [];
      this.alvoUsar = null;
      this.usar(c);
      return;
    }
    let destGx: number, destGy: number;
    if (c) {
      const ap = this.pontoDeAcesso(c);
      destGx = ap.gx; destGy = ap.gy;
      this.alvoUsar = c;
    } else {
      destGx = q.gx; destGy = q.gy;
      this.alvoUsar = null;
    }
    this.destinoRota = { gx: destGx, gy: destGy };
    this.rota = this.tracarRota(destGx, destGy);
    this.bloqueadoCont = 0;
    if (this.rota.length > 0) {
      this.plantarBandeira(destGx, destGy, this.planetaBandeira);
    } else {
      this.recolherBandeira();
    }
  }

  // The A* route to a spot. Driving, it uses the rover's own free test (its whole footprint, like
  // its physics), so the route never squeezes it past a crater rim it cannot cross.
  private tracarRota(gx: number, gy: number) {
    const caixas = this.caixasDeColisao(), t = sessao.terreno;
    const livre = sessao.rover?.dirigindo ? (x: number, y: number) => pontoLivre(t, caixas, x, y, RAIO_ROVER) : undefined;
    return encontrarCaminho(t, caixas, this.corpo.raio, this.corpo.x, this.corpo.y, gx, gy, livre) ?? [];
  }

  /** Plants the flag marking the chosen destination spot on the terrain. */
  private plantarBandeira(gx: number, gy: number, planeta = 'lua') {
    const bInfo = (bandeiras as Record<string, typeof bandeiras.lua>)[planeta] ?? bandeiras.lua;
    const z = sessao.terreno.altura(gx, gy);
    const pe = paraTela(P, gx, gy, z);
    this.bandeira.setTexture(`bandeira_${planeta}`);
    this.bandeira.setOrigin(bInfo.ancora[0] / bInfo.w, bInfo.ancora[1] / bInfo.h);
    this.bandeira.setPosition(pe.x, pe.y);
    this.bandeira.setDepth(PROFUNDIDADE_MARCADOR);
    this.bandeira.setVisible(true).setAlpha(1);

    this.encaixarBandeira(gx,gy,bInfo.w*bInfo.escala*ESCALA_MARCADOR,bInfo.h*bInfo.escala*ESCALA_MARCADOR);
    const cr = sessao.terreno.crateras.find(c=>Math.hypot(gx-c.x,gy-c.y)<c.raio*0.86);
    const t = cr ? Math.hypot(gx-cr.x,gy-cr.y)/cr.raio : 1;
    const descida = cr ? cr.profundidade*(1-(t/0.86)**2)**1.3*Math.abs(P.ez[1]) : 0;

    // Settle into the crater floor rather than appearing at rim height.
    this.tweens.killTweensOf(this.bandeira);
    const escala = bInfo.escala * ESCALA_MARCADOR;
    if(movimentoReduzido()) {this.bandeira.setScale(escala);return;}
    this.bandeira.setScale(escala * 0.8).setY(pe.y-descida);
    this.tweens.add({
      targets: this.bandeira,
      y: pe.y,
      scaleX: escala,
      scaleY: escala,
      duration: 250,
      ease: 'Sine.easeOut',
    });
  }

  private encaixarBandeira(gx: number,gy: number,width: number,height: number) {
    const t=sessao.terreno;
    const foot=paraTela(P,gx,gy,t.altura(gx,gy));
    // A terrain horizon for each sprite column. Foreground rim can hide the mast base,
    // while the marker's foreground depth still keeps it readable near buildings.
    const left=foot.x-12,right=foot.x+width+12,top=foot.y-height*2-24;
    const edge: {x:number;y:number}[]=[];
    const inside=t.crateras.find(c=>Math.hypot(gx-c.x,gy-c.y)<c.raio*1.25);
    for(let x=left;x<=right+2;x+=2) {
      const offset=(x-foot.x)/(P.ex[0]-P.ey[0]);
      let horizon=Infinity;
      const reach=inside?inside.raio*2.5:0.12;
      for(let d=0;d<=reach;d+=0.06) {
        const xx=gx+offset+d,yy=gy-offset+d;
        if(!t.dentro(xx,yy))continue;
        horizon=Math.min(horizon,paraTela(P,xx,yy,t.altura(xx,yy)-0.025).y);
      }
      edge.push({x,y:Number.isFinite(horizon)?horizon:foot.y+height});
    }
    this.mascaraBandeira.clear().fillStyle(0xffffff).fillPoints([{x:left,y:top},{x:right+2,y:top},...edge.reverse()],true);
    const shadow=[];
    for(let i=0;i<24;i++) {
      const a=i*Math.PI*2/24,x=gx+Math.cos(a)*0.15,y=gy+Math.sin(a)*0.11;
      shadow.push(paraTela(P,x,y,t.altura(x,y)+0.006));
    }
    this.sombraBandeira.clear().fillStyle(COR_SOLO_SOMBRA,0.35).fillPoints(shadow,true).setVisible(true);
  }

  /** Smoothly folds and hides the destination flag when arriving or changing path. */
  private recolherBandeira() {
    if (!this.bandeira || !this.bandeira.visible) return;
    this.tweens.killTweensOf(this.bandeira);
    this.tweens.add({
      targets: this.bandeira,
      alpha: 0,
      scaleY: 0,
      duration: 200,
      ease: 'Quad.easeIn',
      onComplete: () => this.bandeira.setVisible(false),
    });
  }

  /** Picks the best approach point for a module: the nearest edge midpoint that is accessible. */
  private pontoDeAcesso(c: Construcao): { gx: number; gy: number } {
    const k = this.corpo;
    const caixas = this.caixasDeColisao();
    const mx = c.gx + c.tipo.w / 2, my = c.gy + c.tipo.h / 2;
    const margem = 0.7;
    // Four edge midpoints (N, S, E, W), sorted by distance to the commander.
    const candidatos = [
      { gx: mx, gy: c.gy - margem },                       // north
      { gx: mx, gy: c.gy + c.tipo.h + margem },            // south
      { gx: c.gx - margem, gy: my },                       // west
      { gx: c.gx + c.tipo.w + margem, gy: my },            // east
    ].sort((a, b) => Math.hypot(a.gx - k.x, a.gy - k.y) - Math.hypot(b.gx - k.x, b.gy - k.y));

    // Exclude module c itself when checking if the spot is blocked by another module
    const outrasCaixas = caixas.filter((b) =>
      Math.abs(b.x0 - (c.gx + 0.08)) > 0.05 || Math.abs(b.y0 - (c.gy + 0.08)) > 0.05
    );

    for (const p of candidatos) {
      if (p.gx >= 1 && p.gy >= 1 && p.gx < sessao.terreno.n - 1 && p.gy < sessao.terreno.n - 1) {
        if (sessao.terreno.inclinacaoEm(p.gx, p.gy) <= sessao.terreno.maxAndar) {
          const colide = outrasCaixas.some((b) => {
            const px = Math.max(b.x0, Math.min(p.gx, b.x1));
            const py = Math.max(b.y0, Math.min(p.gy, b.y1));
            return (p.gx - px) ** 2 + (p.gy - py) ** 2 < (k.raio + 0.08) ** 2;
          });
          if (!colide) return p;
        }
      }
    }
    return candidatos[0];
  }

  // Rooms you can use light up under the cursor, like buttons.
  // The resting tint of a module picture: none on the Moon, Mars's warm light on Mars.
  // With a module, its paint color (won in side missions, cores.ts) goes on top of that.
  private tingir(img?: Phaser.GameObjects.Image, c?: Construcao) {
    if (!img) return;
    const marte = sessao.mundo === 'marte';
    const cor = c ? corPorId(corDoModulo(sessao.mundo, c.tipo.id)) : undefined;
    if (cor) img.setTint(marte ? multiplicarTom(TOM_MARTE, cor.tom) : cor.tom);
    else if (marte) img.setTint(TOM_MARTE); else img.clearTint();
  }

  // Paint mode (key C): a click on a module goes to the next color won; "no color" brings the original back.
  private pintando = false;
  // Also called by the paint button of the mobile controls (mobile.ts).
  alternarPintura() {
    if (sessao.emTarefa || configuracoesAbertas || sessao.transicao) return;
    const toque = dispositivoMovel();
    if (!this.pintando && !coresGanhas().length) {
      sessao.emitir('mensagem', `🎨 Win paint colors in side missions, then ${toque ? 'tap the paint button' : 'press C'} to paint your base!`, '#fde68a');
      return;
    }
    this.pintando = !this.pintando;
    this.input.setDefaultCursor(this.pintando ? 'crosshair' : 'default');
    sessao.emitir('mensagem', this.pintando
      ? `🎨 Paint mode: ${toque ? 'tap' : 'click'} a module to change its color. ${toque ? 'Tap the paint button' : 'Press C'} to stop.`
      : '🎨 Paint mode off.', '#fde68a');
  }
  get pintandoAgora() { return this.pintando; }
  private pintarClique(ptr: Phaser.Input.Pointer) {
    const q = paraChao(P, sessao.terreno, ptr.worldX, ptr.worldY);
    const c = q ? sessao.grade.em(q.gx, q.gy) : null;
    if (!c) return;
    const nova = proximaCor(corDoModulo(sessao.mundo, c.tipo.id), coresGanhas());
    pintarModulo(sessao.mundo, c.tipo.id, nova);
    for (const k of sessao.grade.lista) if (k.tipo.id === c.tipo.id) this.desenharModulo(k);   // same type, same color
    tocarSfx('clique');
    sessao.emitir('mensagem', `🎨 ${this.nomeDe(c)}: ${corPorId(nova)?.nome ?? 'original color'}`, '#fde68a');
  }

  private destacar(c: Construcao | null) {
    const usavel = c && this.usavel(c) ? c : null;
    if (usavel === this.sobre) return;
    if (this.sobre) this.tingir(this.desenhos.get(this.sobre.id)?.img, this.sobre);
    this.sobre = usavel;
    if (usavel) this.desenhos.get(usavel.id)?.img.setTint(0xfff3c4);
    this.input.setDefaultCursor(usavel ? 'pointer' : 'default');
  }

  private entrada(): Entrada {
    const t = this.teclas;
    // Screen directions to map axes: up-screen = -gx -gy, right-screen = +gx -gy.
    let sx = controleMovel.x, sy = controleMovel.y;
    if (t.W.isDown || t.UP.isDown) sy -= 1;
    if (t.S.isDown || t.DOWN.isDown) sy += 1;
    if (t.A.isDown || t.LEFT.isDown) sx -= 1;
    if (t.D.isDown || t.RIGHT.isDown) sx += 1;
    let dx = sx + sy, dy = sy - sx;
    if (sx || sy) { this.rota = []; this.alvoUsar = null; this.alvoRover = false; this.seguir = true; this.recolherBandeira(); }
    else if (this.alvoRover && this.pertoRover()) {
      this.alternarRover();
    }
    else if (this.rota.length) {
      // Follow the A* waypoint list: steer toward the first remaining waypoint, pop it
      // when close enough, and repeat until the route is done.
      const wp = this.rota[0];
      dx = wp.gx - this.corpo.x; dy = wp.gy - this.corpo.y;
      const d = Math.hypot(dx, dy);
      // The rover is heavy and fast: it eases into each waypoint (and stops at the last one)
      // instead of overshooting and circling it, and a waypoint counts as reached at its size.
      const dirigindo = !!sessao.rover?.dirigindo;
      const chegou = dirigindo ? (this.rota.length > 1 ? 0.8 : 0.45) : 0.35;
      if (dirigindo && d > 1e-4) {
        const ultimo = this.rota.length === 1;
        const forca = Phaser.Math.Clamp(d / (ultimo ? 2.6 : 1.6), ultimo ? 0.2 : 0.4, 1);
        dx = (dx / d) * forca; dy = (dy / d) * forca;
      }

      // Check if we should interact with the target module (close enough to any edge).
      if (this.alvoUsar && this.perto(this.alvoUsar)) {
        const u = this.alvoUsar;
        this.rota = []; this.alvoUsar = null; dx = dy = 0;
        this.recolherBandeira();
        this.usar(u);
      } else if (d < chegou) {
        // Reached this waypoint, advance to the next.
        this.rota.shift();
        if (!this.rota.length) {
          dx = dy = 0;
          this.recolherBandeira();
          if (this.alvoUsar && this.perto(this.alvoUsar)) {
            const u = this.alvoUsar;
            this.alvoUsar = null;
            this.usar(u);
          } else {
            this.alvoUsar = null;
          }
        }
      }
    }
    const puloMovel=consumirPuloMovel();
    const pular=Phaser.Input.Keyboard.JustDown(t.SPACE)||puloMovel||sessao.puloTouch;
    sessao.puloTouch=false;
    return { dx, dy, pular };
  }

  // ---------- batteries ----------
  private perto(c: Construcao) {
    const k = this.corpo;
    const px = Phaser.Math.Clamp(k.x, c.gx, c.gx + c.tipo.w), py = Phaser.Math.Clamp(k.y, c.gy, c.gy + c.tipo.h);
    return Math.hypot(k.x - px, k.y - py) <= ALCANCE;
  }

  // Things you can use: where the batteries are, the rooms, and the module that needs fixing today.
  private usavel(c: Construcao) {
    return c.tipo.id === origemBaterias(sessao.mundo) || c.tipo.id === 'habitat' || !!c.tipo.sala || sessao.evento?.construcaoId === c.id || !!estacaoDoModulo(c.tipo.id);
  }

  private usarPerto() {
    if (!this.podeUsarRover()) return;
    if (sessao.rover?.dirigindo || this.pertoRover()) { this.alternarRover(); return; }
    const estacao = this.estacaoPerto();
    if (estacao) { this.usarEstacao(estacao); return; }
    const c = sessao.grade.lista.find((m) => this.perto(m) && this.usavel(m));
    if (c) this.usar(c);
  }

  private abrirGuardaroupa() {
    if (this.scene.isActive('Guardaroupa')) return;
    tocarSfx('clique');
    this.scene.launch('Guardaroupa');
  }

  // The USE button of the touch controls (mobile.ts): the same as E.
  interagirPerto() { this.usarPerto(); }

  // ---------- ship stations (engine/estacoes.ts) ----------
  private pertoDeco(d: DecoColocada) {
    const dx = Math.max(d.gx - this.corpo.x, 0, this.corpo.x - (d.gx + d.w));
    const dy = Math.max(d.gy - this.corpo.y, 0, this.corpo.y - (d.gy + d.h));
    return Math.hypot(dx, dy);
  }

  private estacaoPerto(): DecoColocada | undefined {
    let melhor: DecoColocada | undefined, dm = ALCANCE;
    for (const { d } of this.decoVisuais) { if (!ESTACOES[d.id]) continue; const k = this.pertoDeco(d); if (k <= dm) { dm = k; melhor = d; } }
    return melhor;
  }

  // The station's task, once a day. Closing it early leaves the station for later.
  private usarEstacao(d: DecoColocada) {
    const e = ESTACOES[d.id];
    if (e) this.abrirEstacao(d.id, d.nome, e);
  }

  // Equipment that landed by cargo lander (the Greenhouse, the Ice Drill...): its own task once a day.
  private usarEquipamento(c: Construcao) {
    const e = estacaoDoModulo(c.tipo.id);
    if (e) this.abrirEstacao(chaveModulo(c.tipo.id), this.nomeDe(c), e);
  }

  private abrirEstacao(id: string, nome: string, e: Estacao) {
    if (sessao.emTarefa || sessao.rover?.dirigindo) return;
    const d = { id, nome };
    if (sessao.fase !== 'dia') { sessao.emitir('mensagem', sessao.fase === 'inicio' ? '🚀 Press MENU, then LAUNCH MISSION!' : '🌙 Night time. Wait for morning!'); return; }
    if (!estacaoDisponivel(d.id, sessao.estacoesHoje, sessao.fase)) { sessao.emitir('mensagem', `✅ ${d.nome}: done for today. Come back tomorrow!`, '#86efac'); return; }
    if (sessao.bateriasPendentes) { sessao.emitir('mensagem', "🔋 Main mission first: deliver today's batteries! Follow the yellow arrow.", '#fde047'); return; }
    sessao.emTarefa = true;
    let feito = false;
    this.scene.get(e.cena).events.once('shutdown', () => this.time.delayedCall(0, () => { if (!feito) sessao.emTarefa = false; }));
    this.scene.launch(e.cena, { aoConcluir: () => {
      feito = true;
      sessao.emTarefa = false;
      sessao.estacoesHoje.add(d.id);
      const ganhoOxigenio = Math.min(e.recompensaOxigenio ?? 0, 100 - sessao.estado.oxigenio);
      if (ganhoOxigenio > 0) {
        sessao.estado = { ...sessao.estado, oxigenio: sessao.estado.oxigenio + ganhoOxigenio };
        sessao.emitir('estado');
      }
      const premio = ganhoOxigenio > 0 ? ` +${ganhoOxigenio} oxygen.` : '';
      sessao.emitir('mensagem', `✅ ${d.nome}: ${e.acao.toLowerCase()} done!${premio}`, '#86efac');
      // Sometimes the station gives its own themed item (engine/estacoes.ts), if not owned yet (nor still being made).
      const item = sessao.itemHoje ? undefined : itemDaEstacao(e, (i) => i.tipo === 'skin'
        ? skinsGanhas().includes(i.id) || !this.textures.exists(chaveSkin(i.id))
        : acessoriosGanhos().includes(i.id) || !this.textures.exists(chaveAcessorio(i.id)));
      if (item) this.aplicarPremio(item);
    } });
    this.scene.bringToTop(e.cena);
  }

  // Is this room one of the few with a task today?
  private salaTemTarefaHoje(sala: Efeito) {
    const salas = sessao.grade.lista.flatMap((m) => m.tipo.sala ? [m.tipo.sala] : []);
    return salasComTarefaHoje(sessao.estado.dia, sessao.mundo, salas).includes(sala);
  }

  // The Radiation Shield's door code (engine/senha.ts): just the numbers, painted on the ground in a corner of
  // the map, flat along the map's gx axis. Only while the day-2 solar flare alarm is on (its keypad asks for it).
  private atualizarSenhaNoChao() {
    const ativo = sessao.mundo === 'lua' && sessao.evento?.def.id === EVENTO_SENHA;
    if (!ativo) { this.senhaNoChao?.setVisible(false); return; }
    if (!this.senhaNoChao) {
      const escudo = sessao.grade.lista.find((c) => c.tipo.id === 'blindagem');
      if (!escudo) return;
      const lugar = lugarDaSenha({ gx: escudo.gx, gy: escudo.gy, w: escudo.tipo.w, h: escudo.tipo.h }, (gx, gy) => !sessao.grade.em(gx, gy), sessao.terreno.n);
      const z = sessao.terreno.altura(lugar.gx, lugar.gy);
      const p = paraTela(P, lugar.gx, lugar.gy, z), q = paraTela(P, lugar.gx + 1, lugar.gy, z);
      const angulo = Math.atan2(q.y - p.y, q.x - p.x);
      const pintura = this.add.text(0, 0, senhaDoEscudo(2, 'lua'), letra(40, '#fde047', { stroke: '#1e293b', strokeThickness: 8 })).setOrigin(0.5);
      // Rotated along the ground and squashed across it: it reads as paint lying on the Moon.
      this.senhaNoChao = this.add.container(p.x, p.y, [pintura]).setRotation(angulo).setScale(1, 0.62).setAlpha(0.92).setDepth(2);
      this.mapa.add(this.senhaNoChao);
    }
    this.senhaNoChao.setVisible(this.mapa.visible);
  }

  // A pink shirt icon (bobbing) over the wardrobe (the Habitat, or the Lander on Mars) while a new item waits there.
  private atualizarMarcaGuardaroupa() {
    const hab = sessao.mundo === 'nave' ? undefined : sessao.grade.lista.find((c) => c.tipo.id === 'habitat');
    if (!hab) { this.marcaGuardaroupa?.setVisible(false); return; }
    if (!this.marcaGuardaroupa) {
      const topo = paraTela(P, hab.gx + hab.tipo.w / 2, hab.gy + hab.tipo.h / 2, hab.z + hab.tipo.altura + 1.9);
      this.marcaGuardaroupa = this.add.container(topo.x, topo.y, [
        this.add.circle(0, 0, 17, 0xf472b6).setStrokeStyle(3, 0x1e293b),
        this.add.text(0, 1, '👕', letra(18, '#ffffff')).setOrigin(0.5),
        this.add.text(14, -14, 'NEW', letra(10, '#1e293b', { backgroundColor: '#fde047', padding: { x: 3, y: 1 } })).setOrigin(0.5),
      ]).setDepth(1e6).setData('y0', topo.y);
      this.mapa.add(this.marcaGuardaroupa);
    }
    const ver = this.mapa.visible && temNovidade();
    this.marcaGuardaroupa.setVisible(ver);
    if (ver) this.marcaGuardaroupa.setY((this.marcaGuardaroupa.getData('y0') as number) + (movimentoReduzido() ? 0 : Math.sin(this.time.now / 260) * 4));
  }

  // A blue "!" (bobbing) over the rooms that have a task today and have not done it yet.
  private atualizarMarcasSala() {
    const k = movimentoReduzido() ? 0 : Math.sin(this.time.now / 220) * 3;
    for (const c of sessao.grade.lista) {
      const sala = c.tipo.sala;
      if (!sala) continue;
      let m = this.marcasSala.get(c.id);
      if (!m) {
        const topo = paraTela(P, c.gx + c.tipo.w / 2, c.gy + c.tipo.h / 2, c.z + c.tipo.altura + 1.7);
        m = this.add.container(topo.x, topo.y, [
          this.add.circle(0, 0, 13, 0x38bdf8).setStrokeStyle(3, 0x1e293b),
          this.add.text(0, 0, '!', letra(17, '#1e293b')).setOrigin(0.5),
        ]).setDepth(1e6).setData('y0', topo.y);
        this.mapa.add(m);
        this.marcasSala.set(c.id, m);
      }
      const ver = this.mapa.visible && sessao.fase === 'dia' && !sessao.emTarefa && !this.emObra(c) && !sessao.tarefasHoje.has(sala) && this.salaTemTarefaHoje(sala);
      m.setVisible(ver);
      if (ver) m.setY((m.getData('y0') as number) + k);
    }
  }

  // The "!" over the stations still to do today (bobbing), hidden when done or at night.
  private atualizarEstacoes() {
    const k = movimentoReduzido() ? 0 : Math.sin(this.time.now / 220) * 3;
    for (const c of sessao.grade.lista) {
      if (!estacaoDoModulo(c.tipo.id)) continue;
      let m = this.marcasEquip.get(c.id);
      if (!m) {
        const topo = paraTela(P, c.gx + c.tipo.w / 2, c.gy + c.tipo.h / 2, c.z + c.tipo.altura + 1.1);
        m = this.add.container(topo.x, topo.y, [
          this.add.circle(0, 0, 13, 0xfde047).setStrokeStyle(3, 0x1e293b),
          this.add.text(0, 0, '!', letra(17, '#1e293b')).setOrigin(0.5),
        ]).setDepth(1e6).setData('y0', topo.y);
        this.mapa.add(m);
        this.marcasEquip.set(c.id, m);
      }
      const ver = this.mapa.visible && !sessao.evento && !sessao.bateriasPendentes && estacaoDisponivel(chaveModulo(c.tipo.id), sessao.estacoesHoje, sessao.fase);
      m.setVisible(ver);
      if (ver) m.setY((m.getData('y0') as number) + k);
    }
    for (const m of this.marcasEstacao) {
      const ver = this.mapa.visible && !sessao.bateriasPendentes && estacaoDisponivel(m.d.id, sessao.estacoesHoje, sessao.fase);
      m.c.setVisible(ver);
      if (ver) m.c.setY((m.c.getData('y0') as number) + k);
    }
  }

  private usar(c: Construcao) {
    if (sessao.rover?.dirigindo) return;
    if (sessao.emTarefa) return;
    if (sessao.evento?.construcaoId === c.id && sessao.fase === 'dia') { this.consertar(); return; }
    if (estacaoDoModulo(c.tipo.id)) { this.usarEquipamento(c); return; }
    // The Habitat is the wardrobe (on Mars it is also where the batteries come from: see below).
    if (c.tipo.id === 'habitat' && sessao.mundo !== 'marte') { this.abrirGuardaroupa(); return; }
    if (!c.tipo.sala && c.tipo.id !== origemBaterias(sessao.mundo)) {
      sessao.emitir('mensagem', `💡 ${t(c.tipo.nome)}: ${t(c.tipo.papel)}`);
      return;
    }
    if (sessao.fase !== 'dia') {
      sessao.emitir('mensagem', sessao.fase === 'inicio' ? '🚀 Press MENU, then LAUNCH MISSION!' : '🌙 Night time. Wait for morning!');
      return;
    }
    if (c.tipo.id === origemBaterias(sessao.mundo)) {
      if (!sessao.noHabitat) {
        // Mars: the Lander has no batteries left, so it opens the wardrobe instead.
        if (c.tipo.id === 'habitat') { this.abrirGuardaroupa(); return; }
        sessao.emitir('mensagem', '🔋 Empty! New batteries tomorrow.'); return;
      }
      const pegar = () => {
        sessao.carregando += sessao.noHabitat;
        sessao.noHabitat = 0;
        sessao.emitir('mensagem', `🔋 You have ${sessao.carregando} batteries! Take them to the rooms.`, '#86efac');
        sessao.emitir('estado');
      };
      // Batteries come from the Sun: the first pickup of the day charges them with an energy task.
      if (!sessao.energiaHoje) {
        sessao.energiaHoje = true;
        const lista = (sessao.mundo === 'lua' ? ENERGIA_LUA : ENERGIA).filter((c) => c !== ultimaEnergia);
        const cena = ultimaEnergia = lista[Math.floor(Math.random() * lista.length)];
        sessao.emTarefa = true;
        let feito = false;
        const uma = (pulou=false) => { if (feito) return; feito = true; sessao.emTarefa = false; pegar(); if(pulou)sessao.emitir('mensagem','Charging task skipped. Your batteries are ready.','#fde68a'); };
        this.scene.get(cena).events.once('shutdown', () => this.time.delayedCall(0, () => uma(true)));
        this.scene.launch(cena, { aoConcluir: () => uma(), pular:'energy' });
        this.scene.bringToTop(cena);
        return;
      }
      pegar();
    } else if (c.tipo.sala) {
      if (!sessao.carregando) { sessao.emitir('mensagem', `✋ No batteries! Get some at the ${sessao.mundo === 'lua' ? 'Battery Bank' : 'Lander'}.`); return; }
      // Only some rooms have a task on a given day (engine/tarefasDoDia.ts), a different set each day. The first
      // battery such a room gets comes with a task from the bank (../tarefas). Closing the task (the X / Esc)
      // before the end does NOT deliver the battery: it stays with the commander and the task can be tried again.
      const sala = c.tipo.sala;
      const escolha = sessao.tarefasHoje.has(sala) || !this.salaTemTarefaHoje(sala) ? undefined : escolher(sala, sessao.ultimaTarefa[sala], Math.random, sessao.mundo);
      if (escolha) {
        sessao.tarefasHoje.add(sala);
        sessao.ultimaTarefa[sala] = escolha.id;
        sessao.emTarefa = true;
        const terminar = (concluiu: boolean) => {
          sessao.emTarefa = false;
          if (!concluiu) {
            sessao.tarefasHoje.delete(sala);   // not done: it comes again next time
            sessao.emitir('mensagem', '✋ Task closed. Your battery is still with you: finish the task to deliver it.', '#fde68a');
            return;
          }
          this.entregar(c);
          // A finished standard task gives a prize 70% of the times (engine/presentes.ts).
          if (Math.random() < CHANCE_PREMIO_SALA) this.darPremio('sala');
        };
        if ('tarefa' in escolha) {
          const dados: DadosTarefa = { tarefa: escolha.tarefa, aoTerminar: terminar };
          this.scene.launch('Tarefa', dados);
        } else {
          // A ready scene: the battery goes in only when the task is finished; closing it (X / Esc) leaves it with you.
          let encerrada = false;
          const uma = (concluiu: boolean) => { if (encerrada) return; encerrada = true; terminar(concluiu); };
          const cena = this.scene.get(escolha.cena);
          cena.events.once('shutdown', () => this.time.delayedCall(0, () => uma(false)));
          this.scene.launch(escolha.cena, { aoConcluir: () => uma(true) });
          this.scene.bringToTop(escolha.cena);
        }
        return;
      }
      this.entregar(c);
      return;
    }
    sessao.emitir('estado');
  }

  private podeUsarRover() {
    return this.input.enabled && !sessao.emTarefa && !sessao.abastecendoRover && !configuracoesAbertas && !sessao.transicao && !sessao.voo
      && sessao.vista === 'chao' && (sessao.fase === 'inicio' || sessao.fase === 'dia');
  }

  private pertoRover() {
    const r = sessao.rover;
    return !!r && this.corpo.noChao && Math.hypot(this.corpo.x - r.corpo.x, this.corpo.y - r.corpo.y) <= 2
      && Math.abs(this.corpo.z - r.corpo.z) < 0.4;
  }

  private caminharAoRover() {
    const r = sessao.rover;
    if (!r) return;
    const caixas = this.caixasDeColisao();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const gx = r.corpo.x + Math.cos(a) * 1.4, gy = r.corpo.y + Math.sin(a) * 1.4;
      if (!pontoLivre(sessao.terreno, caixas, gx, gy, this.corpo.raio)) continue;
      const caminho = encontrarCaminho(sessao.terreno, caixas, this.corpo.raio, this.corpo.x, this.corpo.y, gx, gy);
      if (!caminho?.length) continue;
      this.rota = caminho; this.alvoUsar = null; this.alvoRover = true; this.seguir = true;
      this.plantarBandeira(gx, gy);
      return;
    }
    sessao.emitir('mensagem', dispositivoMovel() ? 'Move closer to the rover and tap USE to drive.' : 'Walk closer to the rover and press E to drive.', '#fde68a');
  }

  private alternarRover() {
    const r = sessao.rover;
    if (!r || !this.podeUsarRover()) return;
    if (r.dirigindo) {
      const astronauta = desembarcar(r, sessao.terreno, this.caixasDeColisao());
      if (!astronauta) { sessao.emitir('mensagem', '🚙 No room to get out. Drive to an open spot.', '#fde68a'); return; }
      this.corpo = astronauta;
    } else {
      if (!this.pertoRover()) return;
      if (!sessao.roverCarregado) {
        this.rota = []; this.alvoRover = false; this.alvoUsar = null; this.recolherBandeira();
        if (sessao.carregando < 1) {
          sessao.emitir('mensagem', dispositivoMovel()
            ? `Rover battery empty. Bring 1 battery from the ${sessao.mundo === 'marte' ? 'Lander' : 'Battery Bank'}, then tap USE to install it. One battery lasts all day.`
            : `Rover battery empty. Bring 1 battery from the ${sessao.mundo === 'marte' ? 'Lander' : 'Battery Bank'}, then press E or click the rover to install it. One battery lasts all day.`, '#fde68a');
          return;
        }
        this.abastecerRover();
        return;
      }
      r.dirigindo = true;
      this.corpo = r.corpo;
      this.corpo.vx = this.corpo.vy = 0;
    }
    this.rota = []; this.alvoUsar = null; this.alvoRover = false;
    this.recolherBandeira(); this.seguir = true;
    sessao.emitir('mensagem', dispositivoMovel()
      ? r.dirigindo ? 'Rover: use the joystick to drive and tap USE to get out.' : 'Back on foot! Tap USE near the rover to drive again.'
      : r.dirigindo ? 'Rover: WASD / arrows to drive, E or click the rover to get out. Click the ground to drive there.' : 'Back on foot! Press E near the rover to drive again.', '#93c5fd');
    sessao.emitir('estado');
    const vista = sessao.mundo === 'marte' ? sessao.curiosidadeRoverMarteVista : sessao.curiosidadeRoverVista;
    if (r.dirigindo && !vista) this.scene.launch('CuriosidadeRover');
    else if (r.dirigindo) this.iniciarCorrida();
  }

  // ---------- expeditions (engine/expedicao.ts, engine/exploracao.ts) ----------
  // Once a day, getting into the charged rover starts a delivery run: drive through the flags out to one of
  // the far props of the map (the old lander, the seismometer...). Nothing is won or lost; it is a reason to
  // explore the map.
  private iniciarCorrida() {
    const r = sessao.rover;
    if (!r?.dirigindo || sessao.mundo === 'nave' || sessao.fase !== 'dia' || !sessao.roverCarregado || sessao.corridaHoje || !sessao.podeMissaoSecundaria) return;
    sessao.corridaHoje = true;
    const caixas = this.caixasDeColisao();
    const livre = (x: number, y: number) => pontoLivre(sessao.terreno, caixas, x, y, RAIO_ROVER + 0.2);
    const inicio = { x: r.corpo.x, y: r.corpo.y };
    // The props far from the rover (the farthest few, one at random); the base modules if there are none.
    const longe = sessao.grade.deco.map((d) => ({ x: d.gx + d.w / 2, y: d.gy + d.h / 2, nome: d.nome }))
      .filter((d) => Math.hypot(d.x - inicio.x, d.y - inicio.y) >= 16)
      .sort((a, b) => Math.hypot(b.x - inicio.x, b.y - inicio.y) - Math.hypot(a.x - inicio.x, a.y - inicio.y)).slice(0, 4);
    const modulos = sessao.grade.lista.filter((c) => c.tipo.sala || c.tipo.id === 'plataforma')
      .map((c) => ({ x: c.gx + c.tipo.w / 2, y: c.gy + c.tipo.h / 2, nome: c.tipo.nome }));
    const destino = longe.length ? longe[Math.floor(Math.random() * longe.length)] : maisLonge(inicio, modulos);
    const fim = destino && pontoLivrePerto(destino.x, destino.y, livre, 6);
    const exp = destino && fim ? criarCorridaEntrega(inicio, { ...fim, nome: destino.nome }, livre) : null;
    if (!exp) return;
    sessao.expedicao = exp;
    sessao.tempoExpedicao=0;
    tocarSfx('ok');
    sessao.emitir('mensagem', `Side mission: 🚩 Delivery run! Drive through the flags to bring parts to the ${exp.destino}.`, '#93c5fd');
  }

  // Exploration events: a little while after the morning (from day 2), something sends the commander out of
  // the base. It waits if another expedition or a task is open.
  private passarExploracao(dt: number) {
    if (sessao.exploracaoEm === null || sessao.fase !== 'dia' || sessao.emTarefa || sessao.transicao || this.pouso || sessao.vista !== 'chao' || !sessao.podeMissaoSecundaria) return;
    sessao.exploracaoEm = Math.max(0, sessao.exploracaoEm - dt);
    if (sessao.exploracaoEm > 0) return;
    sessao.exploracaoEm = null;
    this.iniciarExploracao();
  }

  // Also used by the ?debug=1 buttons, with a chosen kind.
  iniciarExploracao(tipo?: TipoExpedicao) {
    const t = tipo ?? sortearTipo(sessao.mundo, sessao.ultimaExploracao);
    if (!t || sessao.expedicao) return false;
    const exp = criarExploracao(t, this.contextoExploracao());
    if (!exp) return false;
    sessao.expedicao = exp;
    sessao.ultimaExploracao = t;
    this.bloqueioExp = 0;
    tocarSfx('aviso');
    sessao.emitir('mensagem', `Side mission: ${AVISOS[t]}`, '#93c5fd');
    return true;
  }

  private contextoExploracao(): Contexto {
    const caixas = this.caixasDeColisao(), lista = sessao.grade.lista, n = sessao.terreno.n;
    const livre = (x: number, y: number) => pontoLivre(sessao.terreno, caixas, x, y, 0.5);
    const centro = lista.length
      ? { x: lista.reduce((s, c) => s + c.gx + c.tipo.w / 2, 0) / lista.length, y: lista.reduce((s, c) => s + c.gy + c.tipo.h / 2, 0) / lista.length }
      : { x: n / 2, y: n / 2 };
    const casa = (sessao.mundo === 'nave' ? lista.find((c) => c.tipo.id === 'oficina') : lista.find((c) => c.tipo.id === 'habitat')) ?? lista[0];
    const cx = casa ? casa.gx + casa.tipo.w / 2 : centro.x, cy = casa ? casa.gy + casa.tipo.h + 1 : centro.y;
    const porta = pontoLivrePerto(cx, cy, livre, 6) ?? { x: cx, y: cy };
    const evitar = lista.map((c) => ({ x: c.gx + c.tipo.w / 2, y: c.gy + c.tipo.h / 2 }));
    const nave = sessao.mundo === 'nave';
    return {
      centro, n, livre, crateras: [...sessao.terreno.crateras], casa: { ...porta, nome: casa ? this.nomeDe(casa) : 'base' }, evitar,
      // The ship's deck (terreno_nave.json): gx 3..21, gy 6..18.
      ...(nave ? { limites: { x0: 3, x1: 21, y0: 6, y1: 18 }, jogador: { x: this.corpo.x, y: this.corpo.y } } : {}),
      mundo: sessao.mundo,
    };
  }

  private passarExpedicao(dt: number) {
    const exp = sessao.expedicao;
    this.bloqueioExp = Math.max(0, this.bloqueioExp - dt);
    this.desenharExpedicao();
    if (!exp) { sessao.pistaExpedicao = null; sessao.alvoExpedicao = null; sessao.progressoExpedicao = 0; return; }
    // A wandering spot (the dust devil) moves on while the day is being played.
    let exp2 = exp;
    if (exp.movel) {
      if (!sessao.emTarefa && !sessao.transicao) sessao.tempoExpedicao += dt;
      exp2 = moverExpedicao(exp, sessao.tempoExpedicao);
      sessao.expedicao = exp2;
    }
    const x = this.corpo.x, y = this.corpo.y;
    const dica = pista(exp2, x, y);
    sessao.pistaExpedicao = dica;
    sessao.alvoExpedicao = alvoDaSeta(exp2, x, y);
    if (sessao.fase !== 'dia' || sessao.emTarefa || sessao.transicao || this.bloqueioExp > 0) return;
    // Hot/cold beeps: the closer, the faster.
    this.proxBip -= dt;
    if (dica && this.proxBip <= 0) { tocarSfx('bip'); this.proxBip = [1.8, 1.2, 0.75, 0.42, 0.2][dica.nivel]; }
    this.avisoAPe = Math.max(0, this.avisoAPe - dt);
    const { e, passou, aPe, progresso, indice } = avancar(exp2, x, y, !!sessao.rover?.dirigindo, dt);
    sessao.progressoExpedicao = progresso;
    if (aPe && !this.avisoAPe) { this.avisoAPe = 6; sessao.emitir('mensagem', '🚙 Get in the rover and drive through the flag!', '#fde68a'); }
    if (e !== exp2) sessao.expedicao = e;
    if (!passou) return;
    sessao.progressoExpedicao = 0;
    if (terminada(e)) { if (e.cena) this.abrirCenaExpedicao(exp2, e); else this.concluirExpedicao(e); return; }
    tocarSfx('encaixe');
    const msgs: Record<string, string> = {
      corrida: `🚩 Flag ${e.atual} of ${e.pontos.length}! Next flag!`,
      amostra: `🧪 You found the sample case! Now bring it back to the ${e.destino}.`,
      balizas: `🔦 Beacon lit! ${e.atual} of ${e.pontos.length}.`,
      tubos: `🧪 Tube ${e.atual} of ${e.pontos.length} collected!`,
      vazamentos: `💨 Leak patched! ${e.atual} of ${e.pontos.length}.`,
      ferramenta: `🔧 You found the wrench! Now bring it to the ${e.destino}.`,
    };
    sessao.emitir('mensagem', msgs[e.tipo] ?? '', '#86efac');
    void indice;
  }

  private concluirExpedicao(e: Expedicao) {
    sessao.expedicao = null;
    tocarSfx('sucesso');
    const msgs: Record<string, string> = {
      corrida: `📦 Parts delivered to the ${e.destino}!`,
      amostra: `🧪 Sample delivered to the ${e.destino}!`,
      balizas: '🔦 All the beacons are on!',
      gelo: '❄ Ice found!',
      tubos: '🧪 All the tubes are collected!',
      vazamentos: '💨 All leaks patched! The air is safe.',
      ferramenta: `🔧 Wrench back in the ${e.destino}!`,
      meteorito: '☄ Space rock scanned!',
      redemoinho: '🌪 You caught the dust devil!',
    };
    sessao.emitir('mensagem', `${msgs[e.tipo] ?? ''} ${e.fato}`, '#86efac');
    this.darPremio(e.tipo);
  }

  // ONE prize per side mission (engine/presentes.ts): mostly customization (astronauts, hats and glasses,
  // faces, base paint), sometimes oxygen or less radiation, and rarely a battery. Items whose picture is not
  // ready yet count as owned, so they are never drawn.
  private darPremio(tipo: TipoPremio) {
    // At most one customization item a day: after it, today's prizes are resources only (as if all were owned).
    const posse: Posse = sessao.itemHoje
      ? { oxigenio: sessao.estado.oxigenio, dose: sessao.estado.dose, acessorios: ACESSORIOS.map((a) => a.id), cores: CORES_BASE.map((c) => c.id), skins: skinsDePremio() }
      : {
        oxigenio: sessao.estado.oxigenio, dose: sessao.estado.dose,
        acessorios: [...acessoriosGanhos(), ...ACESSORIOS.filter((a) => !this.textures.exists(chaveAcessorio(a.id))).map((a) => a.id)],
        cores: coresGanhas(),
        skins: [...skinsGanhas(), ...skinsDePremio().filter((id) => !this.textures.exists(chaveSkin(id)))],
      };
    this.aplicarPremio(sortearPremio(tipo, { ...posse, mundo: sessao.mundo }));
  }

  // Gives one prize (from the draw, or a station's own item) and says so; the first of a kind teaches how to use it.
  private aplicarPremio(premio: Premio) {
    let ensina: 'roupa' | 'tinta' | null = null;
    switch (premio.tipo) {
      case 'bateria': sessao.carregando += premio.qtd; break;
      case 'oxigenio': sessao.estado = { ...sessao.estado, oxigenio: sessao.estado.oxigenio + premio.qtd }; sessao.emitir('estado'); break;
      case 'radiacao': sessao.estado = { ...sessao.estado, dose: sessao.estado.dose - premio.qtd }; sessao.emitir('estado'); break;
      case 'cor': if (ganharCor(premio.id)) ensina = 'tinta'; break;
      case 'skin': if (ganharSkin(premio.id)) { atualizarVideo({ skin: premio.id }); ensina = 'roupa'; } break;
      case 'acessorio': {
        const item = acessorioPorId(premio.id);
        if (item && ganharAcessorio(item.id)) {
          atualizarVideo(item.espaco === 'cabeca' ? { acessorio: item.id } : item.espaco === 'rosto' ? { rosto: item.id } : { carinha: item.id });
          ensina = 'roupa';
        }
        break;
      }
    }
    if (ensina) {
      // A customization item: one a day, a big card with its picture, and an icon over the wardrobe.
      sessao.itemHoje = true;
      marcarNovidade(true);
      const FRENTE = 7 * sprite.colunas;
      const carta = premio.tipo === 'skin'
        ? { titulo: 'NEW ASTRONAUT!', nome: SKINS.find((k) => k.id === premio.id)?.nome ?? premio.id, chave: chaveSkin(premio.id), quadro: FRENTE, corpo: true }
        : premio.tipo === 'acessorio'
          ? { titulo: acessorioPorId(premio.id)?.espaco === 'carinha' ? 'NEW FACE!' : 'NEW ITEM!', nome: acessorioPorId(premio.id)?.nome ?? premio.id, chave: chaveAcessorio(premio.id), quadro: FRENTE, corpo: false }
          : { titulo: 'NEW PAINT!', nome: corPorId((premio as { id: string }).id)?.nome ?? '', chave: '', quadro: 0, corpo: false };
      this.time.delayedCall(500, () => sessao.emitir('premio', carta));
    } else this.time.delayedCall(600, () => sessao.emitir('mensagem', textoDoPremio(premio), '#fde047'));
    // The first cosmetic prize shows how to change clothes, and the first paint color how to paint (once each).
    if (ensina === 'roupa' && !dicaDeTrocaVista()) {
      marcarDicaDeTroca();
      const tecla = dispositivoMovel() ? 'tap USE' : 'press E';
      const onde = sessao.mundo === 'marte' ? 'the Lander (when it has no batteries)' : 'the Habitat';
      this.time.delayedCall(3200, () => sessao.emitir('mensagem', `👕 It is on! To change clothes: walk to ${onde} and ${tecla} for the wardrobe.`, '#fde047'));
    }
    if (ensina === 'tinta' && !dicaDeTintaVista()) {
      marcarDicaDeTinta();
      this.time.delayedCall(3200, () => sessao.emitir('mensagem', dispositivoMovel()
        ? '🎨 To paint your base: tap the 🎨 button, then tap a module. Tap again to try each color.'
        : '🎨 To paint your base: press C, then click a module. Click again to try each color. C stops.', '#fde047'));
    }
  }

  // The last spot opens a task (the ice scanner). Closing it early puts the expedition back one step, and the
  // task only opens again after a few seconds, so walking away is easy.
  private abrirCenaExpedicao(antes: Expedicao, e: Expedicao) {
    sessao.emTarefa = true;
    let feito = false;
    this.scene.get(e.cena!).events.once('shutdown', () => this.time.delayedCall(0, () => {
      if (feito) return;
      sessao.emTarefa = false;
      sessao.expedicao = antes;
      this.bloqueioExp = 6;
      sessao.emitir('mensagem', '❄ The scan was not finished. Walk back to the spot any time to scan again.', '#fde68a');
    }));
    this.scene.launch(e.cena!, { aoConcluir: () => { feito = true; sessao.emTarefa = false; this.concluirExpedicao(e); } });
    this.scene.bringToTop(e.cena!);
  }

  // The markers on the ground. Spots with no arrow (hot/cold) only show up when the player is near.
  private desenharExpedicao() {
    const exp = sessao.expedicao;
    const chave = exp ? `${exp.id}:${exp.feitos.map((f) => (f ? 1 : 0)).join('')}` : '';
    if (chave !== this.chaveExp) {
      this.chaveExp = chave;
      this.bandeirasExp.forEach((b) => b.destroy());
      this.bandeirasExp = [];
      if (exp) exp.pontos.forEach((_p, i) => {
        if (exp.feitos[i] && exp.tipo !== 'balizas' && exp.tipo !== 'vazamentos') return;
        const c = this.criarMarcador(exp, i);
        this.mapa.add(c);
        this.bandeirasExp.push(c);
      });
    }
    if (!exp) return;
    const k = movimentoReduzido() ? 1 : 1 + 0.12 * Math.sin(this.time.now / 180);
    const proximo = alvoDaSeta(exp, this.corpo.x, this.corpo.y);
    for (const c of this.bandeirasExp) {
      const i = c.getData('i') as number, p = exp.pontos[i];
      if (exp.movel && i === 0) {
        const t = paraTela(P, p.x, p.y, sessao.terreno.altura(p.x, p.y));
        c.setPosition(t.x, t.y).setDepth(profundidade(p.x + 0.5, p.y + 0.5));
      }
      const d = Math.hypot(this.corpo.x - p.x, this.corpo.y - p.y);
      // Hidden spots fade in only when close (on the small ship deck, closer still) and never get a ring.
      const esc = exp.escala ?? 1;
      if (c.getData('oculto')) c.setAlpha(Phaser.Math.Clamp((7 * esc - d) / (3 * esc), 0, 1));
      const anel = c.getData('anel') as Phaser.GameObjects.Ellipse | undefined;
      if (anel) anel.setVisible(!exp.feitos[i] && !c.getData('oculto') && (exp.livre || (proximo !== null && proximo === p))).setScale(k);
    }
  }

  private criarMarcador(exp: Expedicao, i: number): Phaser.GameObjects.Container {
    const p = exp.pontos[i], feito = exp.feitos[i];
    const t = paraTela(P, p.x, p.y, sessao.terreno.altura(p.x, p.y));
    const ultima = i === exp.pontos.length - 1;
    const oculto = i < exp.escondidoAte;
    const cor = exp.tipo === 'corrida' ? (ultima ? 0xf97316 : 0xffffff) : 0xfde047;
    const anel = this.add.ellipse(0, 0, 46, 18).setStrokeStyle(3, 0xfde047, 0.9).setVisible(false);
    const itens: Phaser.GameObjects.GameObject[] = [anel];
    const g = this.add.graphics().fillStyle(0x000000, 0.25).fillEllipse(0, 0, 22, 8);
    itens.push(g);
    const contorno = 0x1e293b;
    if (exp.tipo === 'corrida' || (exp.tipo === 'amostra' && ultima)) {
      // A flag; the last one of a run carries a box.
      g.fillStyle(contorno, 1).fillRect(-2.5, -46, 5, 46).fillStyle(0xe2e8f0, 1).fillRect(-1, -45, 2, 44)
        .fillStyle(cor, 1).fillTriangle(1, -46, 30, -38, 1, -29).lineStyle(2.5, contorno, 1).strokeTriangle(1, -46, 30, -38, 1, -29)
        .fillStyle(0xef4444, 1).fillCircle(0, -48, 3.5);
      itens.push(this.add.text(11, -38, ultima ? '📦' : String(i + 1), letra(ultima ? 9 : 10, '#1e293b')).setOrigin(0.5));
    } else if (exp.tipo === 'amostra') {
      g.fillStyle(0xe2e8f0, 1).fillRoundedRect(-14, -18, 28, 16, 4).lineStyle(2.5, contorno, 1).strokeRoundedRect(-14, -18, 28, 16, 4)
        .fillStyle(0xf97316, 1).fillRect(-14, -11, 28, 4).lineStyle(2.5, contorno, 1).strokeRoundedRect(-5, -23, 10, 6, 2);
      itens.push(this.add.star(0, -36, 4, 2, 7, 0xfde047).setStrokeStyle(1.5, contorno));
    } else if (exp.tipo === 'gelo') {
      const cristal = (x: number, h: number, w: number, c: number) => g.fillStyle(c, 1)
        .fillPoints([{ x, y: -h }, { x: x + w, y: -h * 0.45 }, { x, y: 0 }, { x: x - w, y: -h * 0.45 }] as Phaser.Types.Math.Vector2Like[], true)
        .lineStyle(2, contorno, 1).strokePoints([{ x, y: -h }, { x: x + w, y: -h * 0.45 }, { x, y: 0 }, { x: x - w, y: -h * 0.45 }] as Phaser.Types.Math.Vector2Like[], true);
      cristal(-9, 20, 6, 0xbae6fd); cristal(9, 24, 7, 0x7dd3fc); cristal(0, 32, 9, 0xe0f2fe);
      itens.push(this.add.star(12, -34, 4, 1.5, 6, 0xffffff));
    } else if (exp.tipo === 'balizas') {
      g.fillStyle(contorno, 1).fillRect(-2.5, -40, 5, 40).fillStyle(0x94a3b8, 1).fillRect(-1, -39, 2, 38)
        .fillStyle(contorno, 1).fillRoundedRect(-8, -3, 16, 5, 2);
      if (feito) g.fillStyle(0xfde047, 0.3).fillCircle(0, -44, 17);
      g.fillStyle(feito ? 0xfde047 : 0x475569, 1).fillCircle(0, -44, 8).lineStyle(2.5, contorno, 1).strokeCircle(0, -44, 8);
    } else if (exp.tipo === 'meteorito') {
      // A dark metal rock with a shiny spot, half sunk in the dust.
      g.fillStyle(0x6b5b53, 1).fillEllipse(0, -6, 26, 16).lineStyle(2.5, contorno, 1).strokeEllipse(0, -6, 26, 16)
        .fillStyle(0x9ca3af, 1).fillEllipse(-4, -9, 9, 5).fillStyle(0xffffff, 0.9).fillCircle(-6, -10, 1.6);
      itens.push(this.add.star(10, -22, 4, 2, 7, 0xfde047).setStrokeStyle(1.5, contorno));
    } else if (exp.tipo === 'redemoinho') {
      // A tall spinning funnel of light dust with a dark outline, so it stands out on the red ground.
      g.fillStyle(0x431407, 0.35).fillEllipse(0, 0, 44, 14);
      const funil = this.add.container(0, 0);
      for (let k = 0; k < 7; k++) {
        const r = 5 + k * 4.5;
        funil.add(this.add.ellipse(Math.sin(k * 1.3) * 4, -4 - k * 11, r * 2, r * 0.75, 0xfef3c7, 0.85 - k * 0.07).setStrokeStyle(2, 0x7c2d12, 0.9));
      }
      for (let k = 0; k < 5; k++) funil.add(this.add.circle(Math.cos(k * 1.7) * (10 + k * 4), -10 - k * 13, 2.2, 0x7c2d12, 0.9));
      itens.push(funil);
      if (!movimentoReduzido()) this.tweens.add({ targets: funil, scaleX: { from: 0.85, to: 1.15 }, yoyo: true, repeat: -1, duration: 350 });
    } else if (exp.tipo === 'vazamentos') {
      if (feito) {
        // A riveted patch plate on the floor.
        g.fillStyle(0x94a3b8, 1).fillRoundedRect(-11, -7, 22, 12, 3).lineStyle(2, contorno, 1).strokeRoundedRect(-11, -7, 22, 12, 3)
          .fillStyle(contorno, 1).fillCircle(-7, -4, 1.4).fillCircle(7, -4, 1.4).fillCircle(-7, 2, 1.4).fillCircle(7, 2, 1.4);
      } else {
        // A crack with air puffing out of it.
        g.lineStyle(2.5, contorno, 1).lineBetween(-9, -1, -3, -3).lineBetween(-3, -3, 2, 0).lineBetween(2, 0, 9, -2);
        const nuvem = this.add.container(0, -14, [
          this.add.circle(-6, 0, 7, 0xffffff, 0.85), this.add.circle(4, -5, 8, 0xffffff, 0.85), this.add.circle(10, 2, 6, 0xffffff, 0.85),
        ]);
        itens.push(nuvem);
        if (!movimentoReduzido()) this.tweens.add({ targets: nuvem, y: -24, alpha: 0.2, scale: 1.3, duration: 900, repeat: -1 });
      }
    } else if (exp.tipo === 'ferramenta' && !ultima) {
      // A wrench lying on the floor.
      g.fillStyle(0xcbd5e1, 1).fillRoundedRect(-12, -6, 20, 5, 2).lineStyle(2, contorno, 1).strokeRoundedRect(-12, -6, 20, 5, 2)
        .fillStyle(0xcbd5e1, 1).fillCircle(10, -3.5, 6).lineStyle(2, contorno, 1).strokeCircle(10, -3.5, 6)
        .fillStyle(0x1e293b, 1).fillRect(11, -6, 6, 5);
      itens.push(this.add.star(0, -18, 4, 2, 7, 0xfde047).setStrokeStyle(1.5, contorno));
    } else if (exp.tipo === 'ferramenta') {
      g.fillStyle(contorno, 1).fillRect(-2.5, -46, 5, 46).fillStyle(0xe2e8f0, 1).fillRect(-1, -45, 2, 44)
        .fillStyle(0xf97316, 1).fillTriangle(1, -46, 30, -38, 1, -29).lineStyle(2.5, contorno, 1).strokeTriangle(1, -46, 30, -38, 1, -29);
      itens.push(this.add.text(11, -38, '🔧', letra(9, '#1e293b')).setOrigin(0.5));
    } else {
      g.fillStyle(0xf8fafc, 1).fillRoundedRect(-4.5, -26, 9, 24, 4).lineStyle(2.5, contorno, 1).strokeRoundedRect(-4.5, -26, 9, 24, 4)
        .fillStyle(0xf97316, 1).fillRoundedRect(-5.5, -30, 11, 7, 3).lineStyle(2, contorno, 1).strokeRoundedRect(-5.5, -30, 11, 7, 3);
      itens.push(this.add.text(13, -16, String(i + 1), letra(11, '#ffffff', { stroke: '#1e293b', strokeThickness: 3 })).setOrigin(0.5));
    }
    const c = this.add.container(t.x, t.y, itens).setDepth(profundidade(p.x + 0.5, p.y + 0.5));
    c.setData('i', i).setData('oculto', oculto && !feito).setData('anel', anel);
    if (oculto && !feito) c.setAlpha(0);
    return c;
  }

  // Driving a while breaks a fender (paralama-tarefa.ts): the rover stops until the child fixes it.
  // Closing the task without fixing it is fine; the fender breaks again after some more driving.
  private contarOdometro(d: number) {
    if (sessao.fase !== 'dia' || sessao.emTarefa || !sessao.rover || d <= 0 || d > 2) return;
    sessao.odometroRover += d;
    if (!deveQuebrar(sessao.odometroRover, sessao.paralamaHoje)) return;
    sessao.paralamaHoje = true;
    this.corpo.vx = this.corpo.vy = 0; this.input.keyboard?.resetKeys();
    sessao.emTarefa = true;
    tocarSfx('soltar');
    sessao.emitir('mensagem', '🚙 Crack! A fender broke and dust is flying everywhere!', '#fde68a');
    let feito = false;
    const terminar = (consertou: boolean) => {
      if (feito) return; feito = true;
      sessao.emTarefa = false;
      if (consertou) { sessao.emitir('mensagem', '🚙 Fender fixed! Drive on.', '#86efac'); return; }
      sessao.paralamaHoje = false; sessao.odometroRover = 0;
      sessao.emitir('mensagem', '🚙 The fender is still broken. It will need fixing soon!', '#fde68a');
    };
    this.scene.get('ParalamaTarefa').events.once('shutdown', () => this.time.delayedCall(0, () => terminar(false)));
    this.time.delayedCall(500, () => {
      this.scene.launch('ParalamaTarefa', { aoConcluir: () => terminar(true) });
      this.scene.bringToTop('ParalamaTarefa');
    });
  }

  private abastecerRover() {
    const r=sessao.rover;if(!r || sessao.abastecendoRover || sessao.carregando<1)return;
    const dia=sessao.estado.dia;
    sessao.salvar();
    sessao.abastecendoRover=true;
    this.rota=[];this.alvoRover=false;this.alvoUsar=null;this.recolherBandeira();
    this.corpo.vx=this.corpo.vy=0;this.input.keyboard?.resetKeys();
    // The battery goes in through a hands-on task (BateriaRoverTarefa). Closing it (X / Esc) keeps the battery.
    let feito=false;
    const terminar=(instalou:boolean)=>{
      if(feito)return;feito=true;
      sessao.abastecendoRover=false;sessao.emTarefa=false;
      if(!instalou){sessao.emitir('mensagem','🔋 Battery not installed. Press E at the rover to try again.','#fde68a');return;}
      if(sessao.rover!==r || sessao.fase!=='dia' || sessao.estado.dia!==dia || sessao.carregando<1)return;
      sessao.carregando--;sessao.diaCargaRover=dia;
      tocarSfx('ligar');this.aplicarZoom();
      // A frame later, once this scene's input is back on (update), the commander climbs in.
      this.time.delayedCall(60,()=>this.alternarRover());
      sessao.emitir('mensagem','🚙 Rover charged for today!','#86efac');
      sessao.posicaoAstronauta=this.corpo;sessao.salvar();
    };
    sessao.emTarefa=true;
    this.scene.get('BateriaRoverTarefa').events.once('shutdown',()=>this.time.delayedCall(0,()=>terminar(false)));
    this.scene.launch('BateriaRoverTarefa',{aoConcluir:()=>terminar(true)});
    this.scene.bringToTop('BateriaRoverTarefa');
  }

  private animarMontagem() {
    const progresso=sessao.progressoFoguete,antes=this.progressoAnterior;
    this.progressoAnterior=progresso;
    if(sessao.mundo!=='lua' || progresso<=antes)return;
    const pad=sessao.grade.lista.find(c=>c.tipo.id==='plataforma');
    const oficina=sessao.grade.lista.find(c=>c.tipo.id==='oficina');
    if(!pad || !oficina)return;
    const etapa=Math.min(4,Math.floor(progresso/25));
    const mudou=etapa>Math.floor(antes/25);
    const nomes=['Launch pad ready','Engine installed','Fuel tanks installed','Crew capsule installed','Rocket ready for launch!'];
    const fim=paraTela(P,pad.gx+pad.tipo.w/2,pad.gy+pad.tipo.h/2,pad.z+0.9+etapa*0.4);
    const inicio=paraTela(P,oficina.gx+oficina.tipo.w/2,oficina.gy+oficina.tipo.h/2,oficina.z+oficina.tipo.altura);
    const peca=criarIconeJogo(this,inicio.x,inicio.y,'wrench',22).setDepth(1_000_002);
    const texto=rotuloMapa(this,fim.x,fim.y-12,mudou?nomes[etapa]:`Parts delivered · ${Math.round(progresso)}%`,13,mudou?'#86efac':'#fde047').setDepth(1_000_002).setAlpha(0);
    this.mapa.add([peca,texto]);
    tocarSfx('montagem');
    this.tweens.add({targets:peca,x:fim.x,y:fim.y,angle:movimentoReduzido()?0:180,
      duration:movimentoReduzido()?1:750,ease:'Sine.easeInOut',onComplete:()=>{
        peca.destroy();texto.setAlpha(1);
        this.tweens.add({targets:texto,alpha:0,y:fim.y-(movimentoReduzido()?12:32),delay:1800,duration:500,onComplete:()=>texto.destroy()});
      }});
    if(mudou)sessao.emitir('mensagem',`🚀 ${nomes[etapa]} Rocket: ${Math.round(progresso)}%`,'#86efac');
    // Finished early: it still launches only after the last day, so the crew must hold on until then.
    if(mudou && etapa===4 && sessao.estado.dia<=sessao.C.dias)this.time.delayedCall(2600,()=>sessao.emitir('mensagem',`Now survive until the end of day ${sessao.C.dias}: the rocket launches after it.`,'#fde047'));
  }

  // ---------- random events (engine/eventos.ts) ----------
  // The countdown only runs while the day is being played (no task, no settings, no film).
  // With nothing scheduled or open, staying long on the same day makes an event more and more likely.
  private passarEventos(dt: number) {
    if (sessao.fase !== 'dia' || sessao.emTarefa || sessao.transicao || this.pouso) return;
    if (sessao.eventoEm === null) {
      if (sessao.evento || sessao.mundo !== 'lua') return;
      const antes = Math.floor(sessao.tempoCalmo / DEMORA_PASSO);
      sessao.tempoCalmo += dt;
      if (Math.floor(sessao.tempoCalmo / DEMORA_PASSO) === antes || !eventoPorDemora(sessao.estado.dia, sessao.tempoCalmo)) return;
      sessao.eventoEm = 0;
    }
    sessao.eventoEm -= dt;
    if (sessao.eventoEm > 0) return;
    const presentes = sessao.grade.lista.map((c) => c.tipo.id);
    const alarme = sessao.alarmeHoje && presentes.includes(sessao.alarmeHoje.modulo) ? sessao.alarmeHoje : null;
    sessao.alarmeHoje = null;   // also drops an alarm whose module is gone, so it cannot block side missions
    // A side breakdown waits (countdown held at 0) while a side mission runs, the storm alert is on or today's
    // batteries are not delivered yet. The alarm never waits.
    if (!alarme && (sessao.expedicao || sessao.tempestade.status === 'alerta' || sessao.bateriasPendentes)) { sessao.eventoEm = 0; return; }
    sessao.eventoEm = null;
    const def = alarme ?? sortearEvento(presentes, sessao.ultimoEvento);
    const modulos = def ? sessao.grade.lista.filter((c) => c.tipo.id === def.modulo) : [];
    if (!def || !modulos.length) return;
    sessao.evento = { def, construcaoId: modulos[Math.floor(Math.random() * modulos.length)].id };
    sessao.ultimoEvento = def.id;
    sessao.diasCalmos = 0;
    sessao.tempoCalmo = 0;
    const aviso = def.aviso.replace('{nasa}', sessao.dia.curto);
    sessao.emitir('mensagem', def.alarme ? aviso : `Side mission: ${aviso}`, def.alarme ? '#fca5a5' : '#fde68a');
    if (def.alarme) for (let k = 0; k < 3; k++) this.time.delayedCall(k * 380, () => tocarSfx('aviso'));
  }

  // Ship only: now and then a small joke crosses the screen (a saucer, a duck, a comet) and a message
  // tells the fact behind it. It follows the camera, so it is seen at any zoom; it waits while a task plays.
  private passarPassantes(dt: number) {
    if (sessao.mundo !== 'nave') return;
    const p = this.passante;
    if (p && !p.img.active) this.passante = null;
    else if (p) {
      p.t += dt / PASSANTE_DURACAO;
      if (p.t >= 1) { p.img.destroy(); this.passante = null; return; }
      const cam = this.cameras.main, v = cam.worldView, z = cam.zoom;
      p.img.setScale(PASSANTE_ESCALA / z);
      const larg = p.img.displayWidth;
      p.img.setPosition(v.x - larg + p.t * (v.width + 2 * larg), v.y + v.height * p.fy + Math.sin(p.t * Math.PI * 4) * 14 / z)
        .setAngle(Math.sin(p.t * Math.PI * 6) * 5);
      return;
    }
    if (sessao.fase !== 'dia' || sessao.emTarefa || sessao.transicao || this.pouso) return;
    this.proximoPassante -= dt;
    if (this.proximoPassante > 0) return;
    this.proximoPassante = 70 + Math.random() * 80;
    if (movimentoReduzido()) return;
    const def = PASSANTES[Math.floor(Math.random() * PASSANTES.length)];
    const img = this.add.image(0, 0, `mod_${def.id}`).setDepth(2_500_000).setScrollFactor(1);
    this.passante = { img, t: 0, fy: 0.2 + Math.random() * 0.25 };
    sessao.emitir('mensagem', def.texto, def.cor);
  }

  // Walk up to the module and press E (or click it): the task plays, and fixing it gives a bonus battery.
  // Closing the task early leaves the problem there.
  private consertar() {
    const ev = sessao.evento;
    if (!ev) return;
    sessao.emTarefa = true;
    let feito = false;
    this.scene.get(ev.def.cena).events.once('shutdown', () => this.time.delayedCall(0, () => { if (!feito) sessao.emTarefa = false; }));
    this.scene.launch(ev.def.cena, { aoConcluir: () => {
      feito = true;
      sessao.emTarefa = false;
      sessao.evento = null;
      if (ev.def.efeito === 'radiacao') {
        sessao.estado = { ...sessao.estado, dose: Math.max(0, sessao.estado.dose - DOSE_ALARME) };
        sessao.emitir('mensagem', `🛡 Safe! Radiation -${DOSE_ALARME}. ${ev.def.fato}`, '#86efac');
      } else {
        sessao.carregando += BONUS_CONSERTO;
        sessao.emitir('mensagem', `✅ Fixed! +${BONUS_CONSERTO} batteries. ${ev.def.fato}`, '#86efac');
      }
      sessao.emitir('estado');
    } });
    this.scene.bringToTop(ev.def.cena);
  }

  // One battery to a room, through the rules (regras.entregar): on Mars it first builds the
  // module (its construction cost), then powers it.
  private entregar(c: Construcao) {
    const sala = c.tipo.sala!;
    const C = sessao.C;
    const obra = this.emObra(c);
    sessao.carregando--;
    [sessao.estado, sessao.entregas] = entregarRegra(sessao.estado, sessao.entregas, sala, C);
    const n = sessao.entregas[sala];
    if (!obra) sessao.emitir('mensagem', sala === 'blindagem'
      ? `🛡 +1 battery: the water walls go up${n >= 3 ? ' to the top!' : '!'}`
      : `🔋 +1 battery to the ${this.nomeDe(c)}!`, '#86efac');
    else if (pronto(sessao.estado, sala, C)) sessao.emitir('mensagem', `✅ ${this.nomeDe(c)} is built! Now give it batteries to run.`, '#86efac');
    else sessao.emitir('mensagem', `🏗 Building the ${this.nomeDe(c)}: ${sessao.estado.obras[sala] ?? 0} of ${custo(sala, C)}`, '#fde68a');
    sessao.emitir('estado');
  }

  // A room still being built (Mars): its batteries go into construction.
  private emObra(c: Construcao) {
    const sala = c.tipo.sala;
    return !!sala && custo(sala, sessao.C) > 0 && !pronto(sessao.estado, sala, sessao.C);
  }

  private caixasDeColisao() {
    const caixas = sessao.grade.caixas(), L = this.pouso;
    if (!L) return caixas;
    const t = TIPOS[L.tipo];
    return [...caixas, caixaDaEntrega(L.gx, L.gy, t.w, t.h, L.chao, t.altura)];
  }

  // ---------- cargo lander ----------
  // Picks a flat, free spot near the base, then the lander comes down on it with its engine.
  private chegar(tipo: TipoId) {
    if (this.pouso || sessao.grade.lista.some((c) => c.tipo.id === tipo)) return;
    const hab = sessao.grade.lista.find((c) => c.tipo.id === 'habitat')!;
    const t = TIPOS[tipo];
    const [dx, dy] = SETORES_SUPRIMENTOS[tipo] ?? [6, -6];
    const center = Math.floor(sessao.terreno.n / 2);
    const p = sessao.grade.procurarComEspaco(t, center + dx, center + dy);
    if (!p) return;
    const chao = sessao.terreno.alturaMax(p.gx, p.gy, t.w, t.h) + 0.025;
    const img = this.add.image(0, 0, 'mod_pouso');
    const chama = this.add.image(0, 0, 'mod_chama').setBlendMode(Phaser.BlendModes.ADD);
    const sombra = this.add.ellipse(0, 0, 60, 26, 0x000000, 0.25);
    this.mapa.add([sombra, chama, img]);
    this.pouso = { tipo, gx: p.gx, gy: p.gy, z: chao + ALTURA_POUSO, vz: -3, chao, fase: 'descendo', t: 0, empuxo: 0, img, chama, sombra };
    this.seguir = false;
    sessao.emitir('mensagem', `📦 The ${t.nome} is landing! No air, no parachute: rockets brake it.`, '#fde68a');
  }

  // Liftoff at the end of chapter 1 ("Board the ship"): the rocket leaves the pad on its engine,
  // against the Moon's gravity, the camera follows, and `fim` runs once it is out of sight.
  // With reduced motion it just calls `fim`.
  decolar(fim: () => void) {
    const pad = sessao.grade.lista.find((c) => c.tipo.id === 'plataforma');
    if (!pad || movimentoReduzido() || !this.textures.exists(CHAVE_FOGUETE)) { fim(); return; }
    this.foguetePartiu = true;
    this.desenharModulo(pad);
    // The same rocket as the finished pad and the launch film (foguete_voo), not the old trip sprite.
    const img = this.add.image(0, 0, CHAVE_FOGUETE).setOrigin(foguetevoo.pe[0] / foguetevoo.w, foguetevoo.pe[1] / foguetevoo.h).setScale(modelos.foguete4.escala);
    const chama = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.mapa.add([chama, img]);
    const cx = pad.gx + pad.tipo.w / 2, cy = pad.gy + pad.tipo.h / 2;
    this.decolagem = { img, chama, cx, cy, z: pad.z + pad.tipo.altura, vz: 0, t: 0, fim };
    this.seguir = false;
    this.poeira(cx, cy, pad.z + pad.tipo.altura);
    sessao.emitir('mensagem', '🚀 Liftoff! Moon gravity is weak, so it is an easy launch.', '#fde68a');
  }

  private animarDecolagem(dt: number) {
    const D = this.decolagem;
    if (!D) return;
    D.t += dt;
    // Engine thrust grows as the propellant burns off: acceleration G * (2 + 6 t), lunar gravity included.
    D.vz += G * (2 + 6 * D.t) * dt;
    D.z += D.vz * dt;
    const p = paraTela(P, D.cx, D.cy, D.z);
    const prof = 1e6 - 5;
    D.img.setPosition(p.x, p.y).setDepth(prof);
    const s = Math.abs(P.ez[1]) / 36;
    const comp = (34 + 18 * Math.min(1, D.t)) * s * Phaser.Math.FloatBetween(0.85, 1.15);
    D.chama.clear().setDepth(prof - 1)
      .fillStyle(0xfb923c, 0.85).fillTriangle(p.x - 9 * s, p.y, p.x + 9 * s, p.y, p.x, p.y + comp)
      .fillStyle(0xfde68a, 0.95).fillTriangle(p.x - 5 * s, p.y, p.x + 5 * s, p.y, p.x, p.y + comp * 0.55);
    const cam = this.cameras.main;
    cam.centerOn(Phaser.Math.Linear(cam.midPoint.x, p.x, 0.04), Phaser.Math.Linear(cam.midPoint.y, p.y + 60, 0.04));
    if (D.t < 3.2) return;
    D.img.destroy(); D.chama.destroy();
    this.decolagem = null;
    D.fim();
  }

  private animarPouso(dt: number) {
    const L = this.pouso;
    if (!L) return;
    const t = TIPOS[L.tipo];
    L.t += dt;
    if (L.fase === 'descendo') {
      L.empuxo = empuxoDePouso(L.z - L.chao, L.vz, G);
      L.vz += (L.empuxo - G) * dt;
      L.z += L.vz * dt;
      if (L.z <= L.chao) {
        L.z = L.chao; L.vz = 0; L.empuxo = 0; L.fase = 'pousado'; L.t = 0;
        this.poeira(L.gx + t.w / 2, L.gy + t.h / 2, L.chao);
      }
    } else if (L.fase === 'pousado' && L.t > 1.2) {
      // Unload: the equipment joins the base, the lander lifts off for its next trip.
      const c = sessao.grade.construir(t, L.gx, L.gy);
      if (c) {
        this.desenharModulo(c);
        this.desenharCaminhos();
        const d = this.desenhos.get(c.id)!;
        d.img.setAlpha(0); d.rotulo?.setAlpha(0);
        this.tweens.add({ targets: [d.img, d.rotulo].filter(Boolean), alpha: 1, duration: 600 });
        const s = suprimentoDoDia(sessao.estado.dia);
        sessao.emitir('mensagem', s?.tipo === t.id ? `📦 ${t.nome}! ${s.fato}` : `📦 ${t.nome} is here!`, '#86efac');
        sessao.emitir('desbloqueado', c);
      }
      L.fase = 'subindo'; L.t = 0;
    } else if (L.fase === 'subindo') {
      L.empuxo = 2.5 * G;
      L.vz += (L.empuxo - G) * dt;
      L.z += L.vz * dt;
      if (L.z > L.chao + ALTURA_POUSO * 1.4) {
        L.img.destroy(); L.chama.destroy(); L.sombra.destroy();
        this.pouso = null;
        this.seguir = true;
        return;
      }
    }
    // Lander centered on the equipment's footprint (its own is 2 x 2).
    const cx = L.gx + t.w / 2, cy = L.gy + t.h / 2;
    const m = modelos.pouso, mc = modelos.chama;
    const p = paraTela(P, cx - 1, cy - 1, L.z);
    L.img.setOrigin(m.ancora[0] / m.w, m.ancora[1] / m.h).setScale(m.escala).setPosition(p.x, p.y);
    const forca = Phaser.Math.Clamp(L.empuxo / (2 * G), 0, 1.4);
    L.chama.setOrigin(mc.ancora[0] / mc.w, mc.ancora[1] / mc.h).setPosition(p.x, p.y)
      .setScale(mc.escala * (0.6 + 0.4 * forca), mc.escala * (0.4 + 0.8 * forca) * Phaser.Math.FloatBetween(0.85, 1.15))
      .setAlpha(forca > 0.05 ? 0.95 : 0);
    const solo = paraTela(P, cx, cy, L.chao);
    const alto = L.z - L.chao;
    L.sombra.setPosition(solo.x, solo.y).setScale(1 / (1 + alto * 0.08)).setAlpha(Phaser.Math.Clamp(0.35 - alto * 0.015, 0.08, 0.35));
    const prof = profundidade(cx + 1, cy + 1);
    L.sombra.setDepth(prof - 2); L.chama.setDepth(prof + 0.5); L.img.setDepth(prof + 1);
    // Watch it land, then hand the camera back.
    if (sessao.vista === 'chao' && !sessao.voo) {
      const cam = this.cameras.main;
      cam.centerOn(Phaser.Math.Linear(cam.midPoint.x, solo.x, 0.05), Phaser.Math.Linear(cam.midPoint.y, solo.y - 30, 0.05));
    }
  }

  // ---------- the crew's rocket arriving (after the launch film, Chegada.ts) ----------
  // The rocket comes down on the launch pad braking with its engine, lands, then vanishes in a
  // puff of smoke and leaves the empty pad: the crew has to build a new one to reach Mars.
  private pousarFoguete(fim: () => void) {
    if (sessao.mundo === 'marte') { this.pousarNaveMarte(fim); return; }
    const c = sessao.grade.lista.find((k) => k.tipo.id === 'plataforma');
    const d = c && this.desenhos.get(c.id);
    if (!c || !d || !this.textures.exists(CHAVE_FOGUETE)) { fim(); return; }
    sessao.emTarefa = true;
    this.seguir = false;
    this.posicionar(d.img, c, 'plataforma');   // the pad waits empty, ready to receive the rocket
    const cam = this.cameras.main;
    const m4 = modelos.foguete4, mc = modelos.chama;
    const base = paraTela(P, c.gx, c.gy, c.z);
    // Base of the rocket where it stands in the finished pad picture (foguete4), so it lands on
    // exactly the pixels it will occupy once the picture swaps.
    const pe = { x: base.x + (foguetevoo.peNoPad[0] - m4.ancora[0]) * m4.escala, y: base.y + (foguetevoo.peNoPad[1] - m4.ancora[1]) * m4.escala };
    const cx = c.gx + c.tipo.w / 2, cy = c.gy + c.tipo.h / 2;
    const altura = paraTela(P, cx, cy, c.z).y - paraTela(P, cx, cy, c.z + ALTURA_POUSO).y;
    const alturaFoguete = foguetevoo.h * m4.escala;
    const prof = d.img.depth;

    const sombra = this.add.ellipse(pe.x, pe.y - 6, 70, 26, 0x000000, 0.1).setDepth(prof - 0.5);
    const chama = this.add.image(pe.x, pe.y, 'mod_chama').setOrigin(0.5, 0.05).setTint(0xfb923c, 0xfb923c, 0xfde047, 0xfde047).setDepth(prof - 0.4);
    const foguete = this.add.image(pe.x, pe.y - altura, CHAVE_FOGUETE).setOrigin(foguetevoo.pe[0] / foguetevoo.w, 1).setScale(m4.escala).setDepth(prof + 1);
    this.mapa.add([sombra, chama, foguete]);
    sessao.emitir('mensagem', '🚀 Landing! No air, no parachute: the engine brakes.', '#fde68a');

    tocarMotor(3.5, 1, 0.3);
    const voo = { h: 1 };
    const desenhar = () => {
      const y = pe.y - voo.h * altura;
      foguete.setY(y);
      // full burn up high, the flame shortens over the last metres so it never pokes through the pad
      const forca = (0.75 + 0.5 * voo.h) * Phaser.Math.Clamp(voo.h / 0.12, 0, 1);
      chama.setPosition(pe.x, y - 22 * m4.escala).setScale(mc.escala * 1.3 * forca, mc.escala * 1.6 * forca * Phaser.Math.FloatBetween(0.85, 1.15));
      sombra.setScale(1 / (1 + voo.h * 1.5)).setAlpha(0.32 - voo.h * 0.22);
      cam.centerOn(pe.x, Phaser.Math.Linear(pe.y - alturaFoguete * 0.5, y - alturaFoguete * 0.5, 0.6));
    };
    desenhar();
    this.tweens.add({
      targets: voo, h: 0, duration: 3400, ease: 'Cubic.easeOut', onUpdate: desenhar,
      onComplete: () => {
        chama.destroy(); sombra.destroy(); foguete.destroy();
        this.posicionar(d.img, c, 'foguete4');          // the rocket now stands on the pad
        this.poeira(cx, cy, c.z);
        this.cameras.main.shake(260, 0.004);
        tocarSfx('pouso');
        this.time.delayedCall(450, () => tocarSfx('sucesso'));
        sessao.emitir('mensagem', '🎉 Touchdown! Welcome to the Moon!', '#86efac');
        this.time.delayedCall(1300, () => this.fumacaFoguete(pe, alturaFoguete, prof, () => {
          this.posicionar(d.img, c, this.modelo(c));       // back to the empty pad
        }, () => {
          tocarSfx('aviso');
          sessao.emitir('mensagem', '🚀 Our rocket broke. Build a new one to fly to Mars!', '#fde047');
          // Time to read it before the morning chat opens (the chat repeats it on day 1).
          this.time.delayedCall(4500, () => { sessao.emTarefa = false; this.seguir = true; fim(); });
        }));
      },
    });
  }

  // ---------- the crew's rocket arriving on Mars (chapter 3) ----------
  // The same rocket as on the Moon comes down braking with its engine onto the spot of the crew's home,
  // lands, and in a puff of smoke is unpacked into the home (the Habitat on Mars is the lander picture).
  private pousarNaveMarte(fim: () => void) {
    const c = sessao.grade.lista.find((k) => k.tipo.id === 'habitat');
    const d = c && this.desenhos.get(c.id);
    if (!c || !d || !this.textures.exists(CHAVE_FOGUETE)) { fim(); return; }
    sessao.emTarefa = true;
    this.seguir = false;
    this.posicionar(d.img, c, this.modelo(c));
    const cam = this.cameras.main, m4 = modelos.foguete4, mc = modelos.chama;
    const cx = c.gx + c.tipo.w / 2, cy = c.gy + c.tipo.h / 2;
    const pe = paraTela(P, cx, cy, c.z);
    const altura = pe.y - paraTela(P, cx, cy, c.z + ALTURA_POUSO).y;
    const alturaFoguete = foguetevoo.h * m4.escala;
    const prof = d.img.depth;
    const rotuloVisivel = d.rotulo?.visible ?? false;
    d.img.setVisible(false); d.rotulo?.setVisible(false);

    const sombra = this.add.ellipse(pe.x, pe.y - 6, 70, 26, 0x000000, 0.1).setDepth(prof - 0.5);
    const chama = this.add.image(pe.x, pe.y, 'mod_chama').setOrigin(0.5, 0.05).setTint(0xfb923c, 0xfb923c, 0xfde047, 0xfde047).setDepth(prof - 0.4);
    const foguete = this.add.image(pe.x, pe.y - altura, CHAVE_FOGUETE).setOrigin(foguetevoo.pe[0] / foguetevoo.w, 1).setScale(m4.escala).setDepth(prof + 1);
    this.mapa.add([sombra, chama, foguete]);
    sessao.emitir('mensagem', '🚀 Landing on Mars! The thin air slows us a bit, the engine does the rest.', '#fde68a');

    tocarMotor(3.5, 1, 0.3);
    const voo = { h: 1 };
    const desenhar = () => {
      const y = pe.y - voo.h * altura;
      foguete.setY(y);
      const forca = (0.75 + 0.5 * voo.h) * Phaser.Math.Clamp(voo.h / 0.12, 0, 1);
      chama.setPosition(pe.x, y - 22 * m4.escala).setScale(mc.escala * 1.3 * forca, mc.escala * 1.6 * forca * Phaser.Math.FloatBetween(0.85, 1.15));
      sombra.setScale(1 / (1 + voo.h * 1.5)).setAlpha(0.32 - voo.h * 0.22);
      cam.centerOn(pe.x, Phaser.Math.Linear(pe.y - alturaFoguete * 0.5, y - alturaFoguete * 0.5, 0.6));
    };
    desenhar();
    this.tweens.add({
      targets: voo, h: 0, duration: movimentoReduzido() ? 1200 : 3400, ease: 'Cubic.easeOut', onUpdate: desenhar,
      onComplete: () => {
        chama.destroy(); sombra.destroy();
        this.poeira(cx, cy, c.z);
        cam.shake(260, 0.004);
        tocarSfx('pouso');
        this.time.delayedCall(450, () => tocarSfx('sucesso'));
        sessao.emitir('mensagem', '🎉 Touchdown in Jezero crater! Welcome to Mars!', '#86efac');
        this.time.delayedCall(1300, () => this.fumacaFoguete(pe, alturaFoguete, prof, () => {
          foguete.destroy();
          d.img.setVisible(true); d.rotulo?.setVisible(rotuloVisivel);   // the rocket unpacks into our home
        }, () => {
          sessao.emitir('mensagem', '🏠 The rocket became our first Mars home!', '#fde68a');
          this.time.delayedCall(2500, () => { sessao.emTarefa = false; this.seguir = true; fim(); });
        }));
      },
    });
  }

  // A cartoon "poof" over the rocket, in little pieces: small puffs (each with the game's dark
  // outline) pop up one after another until they hide it, the picture swaps behind them, then each
  // puff drifts away and shrinks, with a few sparkles.
  private fumacaFoguete(pe: { x: number; y: number }, alto: number, prof: number, trocar: () => void, fim: () => void) {
    tocarSfx('fumaca');
    const cx = pe.x, cy = pe.y - alto * 0.5;
    const L = Math.max(46, alto * 0.42);   // size of the whole poof, follows the rocket on screen

    // Where the pieces sit, (dx, dy, r) in units of L: a column with a wide base, like the rocket.
    const pecas: [number, number, number][] = [
      [0, -1.0, 0.26], [-0.3, -0.78, 0.24], [0.32, -0.8, 0.25],
      [-0.12, -0.52, 0.27], [0.36, -0.42, 0.24], [-0.44, -0.3, 0.26],
      [0.12, -0.18, 0.28], [-0.2, 0.06, 0.27], [0.5, 0.08, 0.26],
      [-0.56, 0.26, 0.25], [0.2, 0.32, 0.29], [-0.24, 0.52, 0.28],
      [0.58, 0.56, 0.26], [-0.7, 0.72, 0.24], [0.06, 0.74, 0.3],
      [0.4, 0.92, 0.24], [-0.4, 0.94, 0.25], [0.86, 0.9, 0.18], [-0.92, 0.94, 0.17],
    ];
    const ordem = pecas.map((p, i) => ({ p, i })).sort((a, b) => b.p[1] - a.p[1]);   // from the ground up
    const bolas: Phaser.GameObjects.Graphics[] = [];
    ordem.forEach(({ p: [dx, dy, r] }, k) => {
      const x = cx + (dx + Phaser.Math.FloatBetween(-0.05, 0.05)) * L, y = cy + (dy + Phaser.Math.FloatBetween(-0.04, 0.04)) * L;
      const raio = r * L * Phaser.Math.FloatBetween(0.85, 1.15);
      const bola = this.add.graphics().setPosition(x, y).setDepth(prof + 2 + (dy + 2) * 0.01).setScale(0);
      // one to three bubbles per piece, so no two look the same
      const extra: [number, number, number][] = [[0, 0, raio]];
      if (k % 2 === 0) extra.push([raio * 0.62, raio * 0.28, raio * 0.6]);
      if (k % 3 === 0) extra.push([-raio * 0.58, raio * 0.3, raio * 0.55]);
      this.desenharNuvem(bola, extra);
      this.mapa.add(bola);
      bolas.push(bola);
      const atraso = k * 22;
      this.tweens.add({ targets: bola, scale: 1, duration: 260, delay: atraso, ease: 'Back.easeOut' });
      // a little bob while it hangs there
      this.tweens.add({ targets: bola, y: y - raio * 0.15, duration: 300, delay: atraso + 260, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
    });
    this.time.delayedCall(ordem.length * 22 + 260, trocar);

    this.time.delayedCall(1350, () => {
      tocarSfx('bolha');
      // each piece drifts away from the middle and shrinks, the top ones first
      bolas.forEach((bola, k) => {
        const dx = bola.x - cx, dy = bola.y - cy;
        const d = Math.hypot(dx, dy) || 1;
        this.tweens.add({
          targets: bola, x: bola.x + (dx / d) * L * 0.7, y: bola.y + (dy / d) * L * 0.5 - L * 0.35, scale: 0, angle: Phaser.Math.Between(-25, 25),
          duration: 520, delay: (bolas.length - 1 - k) * 18, ease: 'Back.easeIn', onComplete: () => bola.destroy(),
        });
      });
      // sparkles
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.7;
        const est = this.add.graphics().setPosition(cx, cy).setDepth(prof + 2.2).setScale(0);
        this.desenharEstrela(est, L * 0.16);
        this.mapa.add(est);
        this.tweens.add({ targets: est, x: cx + Math.cos(a) * L * 1.3, y: cy + Math.sin(a) * L * 1.5, scale: 1, angle: 90, duration: 380, delay: 250 + i * 40, ease: 'Back.easeOut' });
        this.tweens.add({ targets: est, scale: 0, duration: 260, delay: 750 + i * 40, onComplete: () => est.destroy() });
      }
    });
    this.time.delayedCall(2500, fim);
  }

  // Cartoon puff: one dark outline around its bubbles, a soft shadow, a light top and a shine.
  private desenharNuvem(g: Phaser.GameObjects.Graphics, bolhas: [number, number, number][]) {
    const contorno = 0x1e293b, linha = Math.max(3, bolhas[0][2] * 0.12);
    g.fillStyle(contorno);
    for (const [x, y, r] of bolhas) g.fillCircle(x, y, r + linha);
    g.fillStyle(0xb8c4d6);
    for (const [x, y, r] of bolhas) g.fillCircle(x, y, r);
    g.fillStyle(0xf1f5f9);
    for (const [x, y, r] of bolhas) g.fillCircle(x - r * 0.1, y - r * 0.16, r * 0.8);
    g.fillStyle(0xffffff, 0.95);
    for (const [x, y, r] of bolhas) g.fillEllipse(x - r * 0.34, y - r * 0.42, r * 0.42, r * 0.26);
  }

  // A four-point yellow star with the game's outline.
  private desenharEstrela(g: Phaser.GameObjects.Graphics, r: number) {
    const pontos = (k: number) => {
      const p: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const d = (i % 2 ? r * 0.38 : r) * k;
        p.push(new Phaser.Math.Vector2(Math.cos(a) * d, Math.sin(a) * d));
      }
      return p;
    };
    g.fillStyle(0x1e293b).fillPoints(pontos(1.35), true);
    g.fillStyle(0xfde047).fillPoints(pontos(1), true);
  }

  // ---------- loop ----------
  update(_t: number, dtMs: number) {
    // The ship must not lose elapsed time on 50–100 ms frames. Physics subdivides them.
    // Keep the other worlds' existing timing, and bound recovery after a suspended tab.
    const dt = sessao.mundo === 'nave'
      ? Math.max(0, Math.min(0.1, this.game.loop.rawDelta / 1000))
      : Math.min(0.05, dtMs / 1000);
    this.aplicarZoom();
    const escudo = sessao.grade.lista.find(c => c.tipo.id === 'blindagem');
    const emergencia = sessao.fase === 'dia' && sessao.tempestade.status === 'alerta';
    const mostrarSeta = emergencia && !!escudo && sessao.vista === 'chao';
    this.setaEmergencia.setVisible(mostrarSeta);
    if (mostrarSeta && escudo) {
      // Anchor on the shield module even if its picture is not on screen yet.
      const imagem = this.desenhos.get(escudo.id)?.img;
      const topo = imagem
        ? imagem.getTopCenter()
        : paraTela(P, escudo.gx + escudo.tipo.w / 2, escudo.gy + escudo.tipo.h / 2, escudo.z + escudo.tipo.altura);
      const cam = this.cameras.main;
      // Keep the sign on screen and clear of the fixed HUD strip at the top.
      let baseX = topo.x, baseY = topo.y;
      const paraTelaX = (wx: number) => (wx - cam.scrollX - cam.width / 2) * cam.zoom + cam.x + cam.width / 2;
      const paraTelaY = (wy: number) => (wy - cam.scrollY - cam.height / 2) * cam.zoom + cam.y + cam.height / 2;
      const paraMundoX = (sx: number) => (sx - cam.x - cam.width / 2) / cam.zoom + cam.scrollX + cam.width / 2;
      const paraMundoY = (sy: number) => (sy - cam.y - cam.height / 2) / cam.zoom + cam.scrollY + cam.height / 2;
      const meiaPlaca = (this.larguraPlacaEmergencia / 2) * cam.zoom;
      const topoPlaca = 90 + this.alturaPlacaEmergencia * cam.zoom;
      const telaX = paraTelaX(baseX), telaY = paraTelaY(baseY);
      if (telaY < topoPlaca) baseY = paraMundoY(topoPlaca);
      if (telaX - meiaPlaca < 12) baseX = paraMundoX(12 + meiaPlaca);
      else if (telaX + meiaPlaca > this.scale.width - 12) baseX = paraMundoX(this.scale.width - 12 - meiaPlaca);
      const reduz = movimentoReduzido();
      // Bounce the whole sign (badge and arrow) so both clearly call for attention.
      const onda = Math.sin(_t * Math.PI * 2 / 720);
      const amplitude = reduz ? 5 : 18;
      this.setaEmergencia.setPosition(Math.round(baseX), Math.round(baseY + onda * amplitude));
      this.ponteiroEmergencia.setY(Math.round(12 + (onda + 1) * (reduz ? 0 : 3)));
      this.ponteiroEmergencia.setScale(1 + (reduz ? 0 : 0.08) * (0.5 + 0.5 * onda));
      // The red halo pulses smoothly, like a warning light (steady in comfort mode).
      const pulso = 0.5 + 0.5 * Math.sin(_t * Math.PI * 2 / 520);
      this.contornoEmergencia.setAlpha(reduz ? 0.3 : 0.16 + 0.3 * pulso);
    }
    this.sombraBandeira.setVisible(this.bandeira.visible).setAlpha(this.bandeira.alpha);
    if(configuracoesAbertas || sessao.transicao) {this.input.keyboard?.resetKeys();this.sons.silenciar();this.passada.reiniciar();return;}
    const caixas = this.caixasDeColisao();
    const e = this.input.enabled && (sessao.fase === 'dia' || sessao.fase === 'inicio') ? this.entrada() : null;
    if (sessao.rover && !sessao.rover.dirigindo) desprenderRover(sessao.rover, sessao.terreno, caixas, dt);
    const antesNoChao = this.corpo.noChao;
    const antesX = this.corpo.x, antesY = this.corpo.y;
    if (sessao.rover?.dirigindo && !sessao.roverCarregado) {
      this.corpo.vx = this.corpo.vy = 0;
      this.rota = []; this.alvoUsar = null; this.recolherBandeira();
    }
    const movimento = sessao.rover?.dirigindo
      ? dirigirRover(sessao.rover, sessao.roverCarregado ? e : null, sessao.terreno, caixas, dt)
      : passo(this.corpo, e, sessao.terreno, caixas, dt);
    const { bloqueado } = movimento;
    const recuperado = 'recuperado' in movimento && movimento.recuperado;
    if (recuperado) {
      this.rota = []; this.destinoRota = null; this.alvoUsar = null; this.alvoRover = false;
      this.bloqueadoCont = 0; this.recolherBandeira();
    }
    const pousou = 'pousou' in movimento && movimento.pousou === true;
    if (sessao.rover?.dirigindo && !recuperado) this.contarOdometro(Math.hypot(this.corpo.x - antesX, this.corpo.y - antesY));
    this.passarExploracao(dt);
    this.passarExpedicao(dt);
    // Observe successful controls for the tutorial, without changing movement or physics.
    if (!recuperado && e && (e.dx || e.dy) && Math.hypot(this.corpo.x - antesX, this.corpo.y - antesY) > 0.001 && !this.controlesObservados.has('movimento')) {
      this.controlesObservados.add('movimento'); sessao.emitir('controleUsado', 'movimento');
    }
    if (e?.pular && antesNoChao && !this.corpo.noChao && this.corpo.vz > 0 && !this.controlesObservados.has('pulo')) {
      this.controlesObservados.add('pulo'); sessao.emitir('controleUsado', 'pulo');
    }
    if (this.rota.length > 0 && bloqueado) {
      // Stuck against something: plan the route again from here once, then give up.
      if (++this.bloqueadoCont === 10 && this.destinoRota) {
        const nova = this.tracarRota(this.destinoRota.gx, this.destinoRota.gy);
        if (nova.length) this.rota = nova;
      }
      if (this.bloqueadoCont > 30) {
        this.rota = [];
        this.alvoUsar = null;
        this.bloqueadoCont = 0;
        this.recolherBandeira();
      }
    } else {
      this.bloqueadoCont = 0;
    }
    if (antesNoChao && !this.corpo.noChao && this.corpo.vz > 0 && !sessao.pulou) {
      sessao.pulou = true;
      const terra = pulo(G_TERRA);
      if (sessao.mundo === 'nave') {
        sessao.emitir('mensagem',
          '🧑 Floating in space! Magnet boots keep you on the floor.', '#93c5fd');
      } else {
        const mundo = sessao.mundo === 'marte' ? { nome: 'Mars', g: G_MARTE, cor: '#fdba74' } : { nome: 'Moon', g: G_LUA, cor: '#93c5fd' };
        const vezes = pulo(mundo.g).altura / terra.altura;
        sessao.emitir('mensagem',
          `⭐ ${mundo.nome} jump! ${vezes >= 4 ? Math.round(vezes) : vezes.toFixed(1)}× higher than on Earth!`, mundo.cor);
      }
    }
    // Gait: the Moon's slow bunny hop; on Mars, with more than twice the gravity, quicker steps.
    const caminhando = !sessao.rover?.dirigindo && this.corpo.noChao
      && Math.hypot(this.corpo.x - antesX, this.corpo.y - antesY) > 0.001
      && Math.hypot(this.corpo.vx, this.corpo.vy) > 0.3;
    const passada = this.passada.atualizar(dt, sessao.mundo === 'marte' ? 18 : 12,
      caminhando, this.corpo.noChao, pousou);
    this.quadroPassada = passada.coluna;
    const passosAtivos = this.scene.isVisible() && !document.hidden && this.input.enabled
      && !sessao.emTarefa && (sessao.fase === 'dia' || sessao.fase === 'inicio');
    // Play takeoff/landing once at the physics contact, including jumps made without walking.
    if (passosAtivos && !sessao.rover?.dirigindo) {
      if (antesNoChao && !this.corpo.noChao && this.corpo.vz > 0) {
        tocarSfx(sessao.mundo === 'nave' ? 'puloNave' : sessao.mundo === 'marte' ? 'puloMarte' : 'puloLua');
      } else if (pousou) {
        tocarSfx(sessao.mundo === 'nave' ? 'aterrissarNave' : sessao.mundo === 'marte' ? 'aterrissarMarte' : 'aterrissarLua');
      } else if (passada.contato && !this.astronautaProcedural.passosPropriosAtivos) {
        // Emit only when the displayed sprite enters a boot-contact frame.
        tocarSfx(sessao.mundo === 'nave' ? 'passoNave' : sessao.mundo === 'marte' ? 'passoMarte' : 'passoLua');
      }
    }
    this.animarPouso(dt);
    this.animarDecolagem(dt);
    this.passarEventos(dt);
    this.passarPassantes(dt);
    this.dtAstronauta=dt;
    this.desenharComandante();
    const contatoLunar=this.astronautaProcedural.consumirContatoLunar();
    const botas=this.astronautaProcedural.consumirEventosMagneticos();
    if(passosAtivos&&!pousou&&!(antesNoChao&&!this.corpo.noChao)&&!sessao.rover?.dirigindo){
      if(botas.soltou)tocarSfx('botaSoltar');
      if(botas.fixou)tocarSfx('botaFixar');
    }
    if(contatoLunar && passosAtivos && !pousou && !sessao.rover?.dirigindo)tocarSfx('passoLua');
    if (!sessao.rover) { esconderRover(this.gRover, this.pecasRover); this.dicaRover.setVisible(false); fundoRotulo(this.fundoDicaRover, this.dicaRover); }
    if (sessao.rover) {
      const r = sessao.rover;
      desenharRover(this.gRover, P, r, this.pecasRover, sessao.roverCarregado, sessao.abastecendoRover, dt, COR_SOLO_CLARO, movimentoReduzido());
      const p = paraTela(P, r.corpo.x, r.corpo.y, r.corpo.z + 1.25);
      const carregado = sessao.roverCarregado;
      // Only when standing next to it: not from afar, not while driving.
      const tecla = dispositivoMovel() ? 'USE' : 'E / click';
      const acao = carregado ? `${tecla}: Drive Apollo LRV` : sessao.carregando ? `${tecla}: Install 1 battery & drive` : `Bring 1 battery from the ${sessao.mundo === 'marte' ? 'Lander' : 'Battery Bank'}`;
      const cam=this.cameras.main,wrap=Math.min(320,this.scale.width-64);
      if(this.dicaRover.style.wordWrapWidth!==wrap)this.dicaRover.setWordWrapWidth(wrap,true);
      this.dicaRover.setScale(1/cam.zoom).setText(`Battery: ${carregado ? 'charged' : 'empty'}\n${acao}`);
      const metade=this.dicaRover.displayWidth/2,pad=12/cam.zoom;
      this.dicaRover.setPosition(Phaser.Math.Clamp(p.x,cam.worldView.left+metade+pad,cam.worldView.right-metade-pad),p.y)
        .setVisible(this.podeUsarRover() && !r.dirigindo && this.pertoRover() && cam.worldView.contains(p.x,p.y));
      fundoRotulo(this.fundoDicaRover, this.dicaRover, 0.72);
    }
    sessao.parado = Math.hypot(this.corpo.vx, this.corpo.vy) < 0.05 && this.corpo.noChao;
    this.atualizarOclusao(dt);
    this.desenharPlumas();
    if (this.teto) {
      // Zooming out puts the roof on: the whole closed ship; zooming in shows the deck inside.
      const a = suave(1.3, 1.75, sessao.u);
      this.teto.setAlpha(a).setVisible(a > 0.01);
      for (const t of this.nomesNoMapa) t.setAlpha(1 - a);
    }
    if(this.mapa.visible) this.ambiente.update(dt,this.corpo,sessao.grade.lista,sessao.rover,{ativo:this.astronautaProcedural.passosLunaresAtivos,contato:contatoLunar});
    const ativo=this.scene.isVisible() && !document.hidden && this.input.enabled && (sessao.fase==='dia'||sessao.fase==='inicio');
    let proximidade=0;
    for(const c of sessao.grade.lista) {
      if(!c.tipo.sala && c.tipo.id!=='habitat') continue;
      const dx=c.gx+c.tipo.w/2-this.corpo.x,dy=c.gy+c.tipo.h/2-this.corpo.y;
      proximidade=Math.max(proximidade,1/(1+(dx*dx+dy*dy)*0.2));
    }
    this.sons.atualizar(sessao.rover?.dirigindo?Math.hypot(this.corpo.vx,this.corpo.vy)/6.4:0,proximidade,ativo);
    sessao.posicaoAstronauta=this.corpo;
    sessao.atualizarSalvamento(dtMs);
    if(!this.pouso && this.suprimentosPendentes.length && sessao.fase==='dia') this.chegar(this.suprimentosPendentes.shift()!);
    this.animarModulos(dt);
    this.atualizarDica(dt);
    this.atualizarEstacoes();
    this.atualizarMarcasSala();
    this.atualizarMarcaGuardaroupa();
    this.atualizarSenhaNoChao();

    // Camera follows the commander on the ground.
    if (sessao.vista === 'chao' && !sessao.voo && this.seguir && !this.pouso) {
      const pe = paraTela(P, this.corpo.x, this.corpo.y, this.corpo.z);
      const cam = this.cameras.main;
      const suavizacao = 1 - Math.pow(1 - 0.12, dt * 60);
      cam.centerOn(Phaser.Math.Linear(cam.midPoint.x, pe.x, suavizacao), Phaser.Math.Linear(cam.midPoint.y, pe.y, suavizacao));
    }
  }

  // Dust kicked up by the engine: it flies in clean arcs and drops straight back (no air).
  private poeira(gx: number, gy: number, z: number) {
    const p = paraTela(P, gx, gy, z);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const d = this.add.circle(p.x, p.y, Phaser.Math.Between(2, 4), COR_SOLO_CLARO).setDepth(profundidade(gx, gy) + 5);
      this.mapa.add(d);
      this.tweens.add({ targets: d, x: p.x + Math.cos(a) * 55, y: p.y + Math.sin(a) * 24, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => d.destroy() });
    }
  }

  // ---------- drawing ----------
  // Which Blender picture a module shows: the launch pad carries the rocket in 5 build stages, and
  // the shield tower's water walls fill with each battery given to it today (the pump runs on
  // them). While just exploring, the walls are shown full.
  private modelo(c: Construcao): Modelo {
    // Mars: the lander is the crew's home until the dome is built. Heating has its own model;
    // the dome still uses the habitat picture.
    if (sessao.mundo === 'marte') {
      if (c.tipo.id === 'habitat') return 'pouso';
      if (c.tipo.id === 'aquecedor') return 'aquecedor';
      if (c.tipo.id === 'cupula') return 'habitat';
    }
    // The ship: the team's air recycler for Life Support, the ship's engine room for the Engines.
    if (sessao.mundo === 'nave') {
      if (c.tipo.id === 'suporte') return 'reciclador';
      if (c.tipo.id === 'oficina') return 'nave_motores' as Modelo;
    }
    if (c.tipo.id === 'aquecedor') return 'aquecedor';
    if (c.tipo.id === 'cupula') return 'habitat';
    if (c.tipo.id === 'bateria') return modeloBancoBaterias(sessao.noHabitat, sessao.fase === 'inicio') as Modelo;
    const meta = sessao.estado.meta;
    if (c.tipo.id === 'plataforma' && this.foguetePartiu) return 'plataforma';
    if (c.tipo.id === 'plataforma') return `foguete${Math.min(4, Math.floor(sessao.progressoFoguete / 25))}` as Modelo;
    if (c.tipo.id === 'blindagem' && sessao.fase !== 'inicio') return `blindagem_agua${Math.min(3, sessao.entregas.blindagem)}` as Modelo;
    return c.tipo.id as Modelo;
  }

  // Puts a module picture on the map: its anchor pixel is the footprint corner (gx, gy) at floor height.
  private posicionar(img: Phaser.GameObjects.Image, c: Construcao, id: Modelo) {
    const chave=c.rotacao?`${id}_r${c.rotacao}`:id;
    const m = QUADROS[chave]??QUADROS[id];
    // A picture drawn for a smaller footprint (the lander, the air recycler) is centered on the module's.
    const pg = m.pegada ?? PEGADA_MODELO[id];
    const kx = pg ? (c.tipo.w - pg[0]) / 2 : 0, ky = pg ? (c.tipo.h - pg[1]) / 2 : 0;
    const p = paraTela(P, c.gx + kx, c.gy + ky, c.z);
    img.setTexture(`mod_${QUADROS[chave]?chave:id}`).setAngle(0).setOrigin(m.ancora[0] / m.w, m.ancora[1] / m.h).setScale(m.escala).setPosition(p.x, p.y);
  }

  // A prop's picture: the ship's own, the Mars version on Mars (deco_marte_<id>), a pre-turned picture for a
  // turned prop (_r<n>) when there is one, else the plain picture mirrored for a quarter turn (old look).
  private posicionarDeco(img:Phaser.GameObjects.Image,d:DecoColocada) {
    const marte=sessao.mundo==='marte' && QUADROS[`deco_marte_${d.id}`]?`deco_marte_${d.id}`:null;
    const base=d.id.startsWith('nave_')?d.id:marte??`deco_${d.id}`,chave=d.rotacao?`${base}_r${d.rotacao}`:base;
    const key=QUADROS[chave]?chave:base,m=QUADROS[key],p=paraTela(P,d.gx,d.gy,d.z);
    const espelho=key===base && (d.rotacao??0)%2===1;
    img.setTexture(`mod_${key}`).setAngle(0).setOrigin(espelho?1-m.ancora[0]/m.w:m.ancora[0]/m.w,m.ancora[1]/m.h).setFlipX(espelho)
      .setScale(m.escala).setPosition(p.x,p.y).setDepth(profundidade(d.gx+d.w,d.gy+d.h));
  }

  // Surface props (old rover, probe, beacon...): placed once on free flat ground, solid, each with its name.
  private montarDeco() {
    const g = sessao.grade, c0 = Math.floor(g.n / 2);
    this.decoVisuais = []; this.marcasEstacao = []; this.marcasEquip = new Map(); this.marcasSala = new Map(); this.marcaGuardaroupa = null; this.senhaNoChao = null; this.decoSobre = null; this.decoFixa = null; this.decoFixaT = 0;
    if (!g.deco.length) {
      // Each world has its own props and facts (Mars: DECORACAO_MARTE).
      const lista = sessao.mundo === 'nave' ? DECO_NAVE : sessao.mundo === 'marte' ? DECORACAO_MARTE : DECORACAO;
      const plano = LAYOUT[sessao.mundo]?.itens ?? [];
      lista.forEach((d, k) => {
        // The layout editor's spot (same id at the same place in the list), else the old search.
        const l = plano[k]?.[0] === d.id ? plano[k] : null;
        const girado = !!l?.[3];   // turned in the layout editor: a quarter turn
        const w = girado ? d.h : d.w, h = girado ? d.w : d.h;
        const tipo = comoTipo({ ...d, w, h }), x = l ? l[1] : c0 + d.dx, y = l ? l[2] : c0 + d.dy;
        const p = g.pode(tipo, x, y).motivo === 'ok' && (l || sessao.mundo === 'nave') ? { gx: x, gy: y }
          : sessao.mundo !== 'nave' ? g.procurarDeco(tipo, x, y) : g.procurarComEspaco(tipo, x, y);
        if (p) g.colocarDeco({ id: d.id, nome: d.nome, info: d.info, w, h, altura: d.altura, ...(girado ? { rotacao: ROTACAO_LAYOUT } : {}) }, p.gx, p.gy);
      });
    }
    // Add missing construction props to older saved layouts without replacing any objects.
    if(sessao.mundo!=='nave')for(const d of OBJETOS_CONSTRUCAO)if(!g.deco.some(p=>p.id===d.id)){
      const p=g.procurarDeco(comoTipo(d),c0+d.dx,c0+d.dy);
      if(p)g.colocarDeco(d,p.gx,p.gy);
    }
    for (const d of g.deco) {
      // The ship's props have their own pictures; on Mars the props the Moon also has use their Mars version
      // (deco_marte_<id>: red dust, Mars details) when there is one.
      const marte = sessao.mundo === 'marte' && QUADROS[`deco_marte_${d.id}`] ? `deco_marte_${d.id}` : null;
      const chave = d.id.startsWith('nave_') ? d.id : marte ?? `deco_${d.id}`;
      const m = QUADROS[chave];
      const p = paraTela(P, d.gx, d.gy, d.z);
      const img = this.add.image(p.x, p.y, `mod_${chave}`)
        .setOrigin(m.ancora[0] / m.w, m.ancora[1] / m.h).setScale(m.escala)
        .setDepth(profundidade(d.gx + d.w, d.gy + d.h));
      this.posicionarDeco(img,d);
      if (sessao.mundo === 'marte') img.setTint(TOM_MARTE);
      this.mapa.add(img);
      this.decoVisuais.push({ d, img });
      if (ESTACOES[d.id]) {
        const topo = paraTela(P, d.gx + d.w / 2, d.gy + d.h / 2, d.z + d.altura + 0.9);
        const c = this.add.container(topo.x, topo.y, [
          this.add.circle(0, 0, 11, 0xfde047).setStrokeStyle(3, 0x1e293b),
          this.add.text(0, 0, '!', letra(15, '#1e293b')).setOrigin(0.5),
        ]).setDepth(1e6).setData('y0', topo.y);
        this.mapa.add(c);
        this.marcasEstacao.push({ d, c });
      }
    }
    // One shared tooltip: names are hidden until the cursor or the commander is on the prop.
    this.dica = this.add.text(0, 0, '', letra(13, '#ffffff', {
      align: 'center', wordWrap: { width: 230 }, padding: { x: 14, y: 8 },
      resolution: (window.devicePixelRatio || 1) * ZOOM_MAX,
    })).setOrigin(0.5, 1).setDepth(1e6 + 1).setVisible(false);
    this.fundoDica = this.add.graphics();
    this.mapa.add([this.fundoDica, this.dica]);
  }

  // Prop under a screen point (its picture's box), the closest to the viewer if several overlap.
  private decoEm(wx: number, wy: number) {
    let melhor: (typeof this.decoVisuais)[number] | null = null;
    for (const v of this.decoVisuais) {
      if (v.img.getBounds().contains(wx, wy) && (!melhor || v.img.depth > melhor.img.depth)) melhor = v;
    }
    return melhor?.d ?? null;
  }

  // Which prop shows its tooltip: a tapped one, else the hovered one, else the one the commander touches.
  private atualizarDica(dt: number) {
    if (!this.dica) return;
    this.decoFixaT = Math.max(0, this.decoFixaT - dt);
    let alvo = this.decoFixaT > 0 ? this.decoFixa : this.decoSobre;
    if (!alvo) {
      let melhor = 0.9;   // tiles from the prop's edge
      for (const { d } of this.decoVisuais) {
        const dx = Math.max(d.gx - this.corpo.x, 0, this.corpo.x - (d.gx + d.w));
        const dy = Math.max(d.gy - this.corpo.y, 0, this.corpo.y - (d.gy + d.h));
        const dist = Math.hypot(dx, dy);
        if (dist < melhor) { melhor = dist; alvo = d; }
      }
    }
    if (!alvo || !this.mapa.visible) { this.dica.setVisible(false); if (this.fundoDica) fundoRotulo(this.fundoDica, this.dica); return; }
    const topo = paraTela(P, alvo.gx + alvo.w / 2, alvo.gy + alvo.h / 2, alvo.z + alvo.altura + 0.5);
    const extra = textoEstacao(alvo.id, sessao.estacoesHoje, sessao.fase);
    this.dica.setText(`${alvo.nome}\n${alvo.info}${extra ? `\n${extra}` : ''}`).setPosition(topo.x, topo.y)
      .setScale(1 / Math.max(0.5, this.cameras.main.zoom)).setVisible(true);
    if (this.fundoDica) fundoRotulo(this.fundoDica, this.dica);
  }

  private desenharModulo(c: Construcao) {
    let d = this.desenhos.get(c.id);
    if (!d) {
      d = { g: this.add.graphics(), img: this.add.image(0, 0, 'mod_habitat') };
      // Rooms you use carry their name, like the first prototype.
      if (c.tipo.id !== 'painel') {
        d.rotulo = this.add.text(0, 0, this.nomeDe(c), letra(13, '#ffffff', { stroke: '#1e293b', strokeThickness: 4, resolution: (window.devicePixelRatio || 1) * ZOOM_MAX }))
          .setOrigin(0.5, 1);
      }
      this.mapa.add([d.g, d.img, ...(d.rotulo ? [d.rotulo] : [])]);
      if (d.rotulo) this.nomesNoMapa.push(d.rotulo);
      this.desenhos.set(c.id, d);
    }
    d.g.clear();
    fundacao(d.g, P, c, (x, y) => sessao.terreno.altura(x, y));
    this.posicionar(d.img, c, this.modelo(c));
    if (this.sobre !== c) this.tingir(d.img, c);
    // Sort by the module's back corner (where its picture is anchored), not its front corner:
    // using the front corner pushed every module in front of the commander, so the astronaut
    // disappeared under it whenever walking next to a wall.
    const prof = profundidade(c.gx, c.gy);
    d.g.setDepth(prof - 1); d.img.setDepth(prof);
    if (d.rotulo && c.tipo.sala) {
      const sala = c.tipo.sala;
      d.rotulo.setText(this.emObra(c) ? `${this.nomeDe(c)}\nto build: ${sessao.estado.obras[sala] ?? 0} of ${custo(sala, sessao.C)}` : this.nomeDe(c))
        .setColor(this.emObra(c) ? '#fde68a' : '#f8fafc').setAlign('center');
    }
    if (d.rotulo) {
      if(c.tipo.id==='plataforma' && sessao.mundo==='lua') d.rotulo.setText(`Rocket · ${Math.round(sessao.progressoFoguete)}%`);
      // The launch pad's own altura is tiny (0.25) but the rocket on top can be very tall,
      // and the rocket workshop has a high antenna/crane. Calculate visual height from
      // the model sprite anchor and add sufficient clearance so labels float cleanly above.
      const modelo = this.modelo(c);
      const m = QUADROS[modelo];
      const alturaVisual = m ? (m.ancora[1] * m.escala) / Math.abs(P.ez[1]) : c.tipo.altura;
      let folga = 0.6;
      if (c.tipo.id === 'plataforma') {
        folga = 1.15; // Just a touch higher above the rocket tip
      } else if (c.tipo.id === 'oficina') {
        folga = 0.9; // Just above the workshop antenna
      }
      const topo = paraTela(P, c.gx + c.tipo.w / 2, c.gy + c.tipo.h / 2, c.z + Math.max(c.tipo.altura, alturaVisual) + folga);
      d.rotulo.setPosition(topo.x, topo.y).setDepth(1e6);
    }
  }

  // Subtle surface tracks follow actual walkable routes and terrain height.
  private desenharCaminhos() {
    const g = this.gCaminhos.clear();
    if (sessao.mundo === 'nave') return;          // the ship has its corridor, not worn tracks
    const hab = sessao.grade.lista.find(c => c.tipo.id === 'habitat');
    if (!hab) return;
    const start = { gx: hab.gx+hab.tipo.w/2, gy: hab.gy+hab.tipo.h+0.65 };
    const boxes = this.caixasDeColisao();
    for (const c of sessao.grade.lista) {
      if (c === hab || c.tipo.id === 'painel') continue;
      const candidates = [
        {gx:c.gx+c.tipo.w/2,gy:c.gy+c.tipo.h+0.65},
        {gx:c.gx+c.tipo.w+0.65,gy:c.gy+c.tipo.h/2},
        {gx:c.gx-0.65,gy:c.gy+c.tipo.h/2},
        {gx:c.gx+c.tipo.w/2,gy:c.gy-0.65},
      ];
      let best: Ponto[] | null = null, shortest = Infinity;
      for (const end of candidates) {
        const path = encontrarCaminho(sessao.terreno,boxes,0.22,start.gx,start.gy,end.gx,end.gy);
        if (!path) continue;
        const full = [start,...path];
        let length = 0;
        for(let i=1;i<full.length;i++) length += Math.hypot(full[i].gx-full[i-1].gx,full[i].gy-full[i-1].gy);
        if(length < shortest) {shortest=length;best=full;}
      }
      if (!best) continue;
      const points: {x:number;y:number}[] = [];
      for(let i=1;i<best.length;i++) {
        const a=best[i-1],b=best[i],steps=Math.max(1,Math.ceil(Math.hypot(b.gx-a.gx,b.gy-a.gy)*4));
        for(let j=0;j<=steps;j++) {
          const x=a.gx+(b.gx-a.gx)*j/steps,y=a.gy+(b.gy-a.gy)*j/steps;
          points.push(paraTela(P,x,y,sessao.terreno.altura(x,y)+0.01));
        }
      }
      g.lineStyle(9,COR_SOLO_MEDIO,0.20).strokePoints(points,false);
      g.lineStyle(2,COR_SOLO_CLARO,0.22).strokePoints(points,false);
    }
  }

  private animarModulos(dt: number) {
    const animate=video.efeitos && !movimentoReduzido();
    if(animate) this.tempoEfeitos=this.time.now/1000;
    for(const c of sessao.grade.lista) {
      if(c.tipo.id!=='suporte' && c.tipo.id!=='oficina') continue;
      if(this.modelo(c)!==c.tipo.id) continue;   // another world's picture (the ship's recycler and engines) has no animation frames
      const d=this.desenhos.get(c.id);if(!d) continue;
      // Only the instrument display changes, using actual Blender renders. The model stays still.
      const frame=animate ? Math.floor(this.tempoEfeitos/(video.qualidade==='leve'?1.3:0.85)+c.id)%3 : 0;
      const key=(frame ? `${c.tipo.id}_anim${frame}` : c.tipo.id) as Modelo;
      const orientado=c.rotacao?`${key}_r${c.rotacao}`:key;
      if(d.img.texture.key!==`mod_${orientado}` && this.textures.exists(`mod_${orientado}`)) this.posicionar(d.img,c,key);
    }
  }

  private atualizarOclusao(dt: number) {
    const k = this.corpo;
    const depth = profundidade(k.x + 0.3, k.y + 0.3);
    const feet = paraTela(P, k.x, k.y, k.z);
    for (const c of sessao.grade.lista) {
      const d = this.desenhos.get(c.id);
      if (!d) continue;
      const bounds = d.img.getBounds(this.limitesOclusao);
      const overlaps = bounds.contains(feet.x, feet.y - 15) || bounds.contains(feet.x, feet.y - 26);
      const behind = k.x < c.gx + c.tipo.w && k.y < c.gy + c.tipo.h && k.z < c.z + c.tipo.altura - 0.1;
      const normal = profundidade(c.gx + c.tipo.w, c.gy + c.tipo.h);
      const order = overlaps ? (behind ? Math.max(normal, depth + 0.5) : Math.min(normal, depth - 0.5)) : normal;
      // setDepth re-sorts the layer: only when the order really changes.
      if (d.img.depth !== order) { d.img.setDepth(order); d.g.setDepth(order - 0.1); }
      const alpha = overlaps && behind ? 0.38 : this.emObra(c) ? 0.35 : 1;   // construction sites are ghosts
      const next = Phaser.Math.Linear(d.img.alpha, alpha, 1 - Math.exp(-dt * 12));
      d.img.setAlpha(next); d.g.setAlpha(next);
    }
  }

  // The accessories follow the astronaut sprite: same position, depth just above, same frame. The sheets have
  // the walking sheet's layout (8 rows x 9 columns); the seated sheet has one column, so there it is column 0.
  // The carrying sheet keeps the head where the walking one has it.
  private desenharChapeu() {
    const dirigindo = sessao.rover?.dirigindo ?? false;
    const f = Number(this.comandante.frame.name);
    const quadro = dirigindo ? this.direcao * sprite.colunas : Number.isFinite(f) ? f : 0;
    [video.carinha, video.rosto, video.acessorio].forEach((id, i) => {
      const s = this.acessoriosSprites[i], chave = chaveAcessorio(id);
      if (!id || !this.textures.exists(chave)) { s.setVisible(false); return; }
      if (s.texture.key !== chave) s.setTexture(chave);
      s.setVisible(this.comandante.visible).setFrame(quadro).setPosition(this.comandante.x, this.comandante.y).setDepth(this.comandante.depth + 0.01 * (i + 1));
    });
  }

  // The astronaut being worn, or the commander while its picture is not ready (or was never won).
  private skinAtiva() {
    const id = video.skin;
    return this.textures.exists(chaveSkin(id)) && this.textures.exists(chaveSkinSentado(id)) ? id : SKIN_PADRAO;
  }

  private desenharComandante() {
    this.desenharComandanteBase();
    this.desenharChapeu();
  }

  private desenharComandanteBase() {
    const dirigindo = sessao.rover?.dirigindo ?? false;
    this.comandante.setVisible(true);
    this.gAstronauta.setVisible(!dirigindo);
    // On the rover: the seated sheet (the same model, legs forward), whole, hips on the seat.
    const comCarga = sessao.carregando > 0 && !dirigindo && this.textures.exists(chaveSkinCarga(this.skinAtiva()));
    const textura = dirigindo ? chaveSkinSentado(this.skinAtiva()) : comCarga ? chaveSkinCarga(this.skinAtiva()) : chaveSkin(this.skinAtiva());
    if (this.comandante.texture.key !== textura) this.comandante.setTexture(textura);
    if (dirigindo) {
      const r = sessao.rover!;
      this.direcao = ((Math.round(-r.angulo/(Math.PI/4))%8)+8)%8;
      // The rover is drawn in 16 fixed headings: the seat and the driver follow that same heading,
      // not the rover's exact angle, or the driver slid on the seat while the picture stood still.
      // (The seated sheet has 16 directions; an older 8 row one still works.)
      const k16 = direcaoRover(r.angulo), aq = (k16 * 2 * Math.PI) / 16;
      const n = this.textures.get(textura).frameTotal - 1 >= 16 ? 16 : 8;
      const quadroSentado = n === 16 ? (16 - k16) % 16 : ((Math.round(-aq / (Math.PI / 4)) % 8) + 8) % 8;
      // Fixed to the seat: the driver rides exactly the rover's own bounce, no lag, no slide.
      const salto = movimentoReduzido() ? 0 : saltoRover(r);
      const assento = paraTela(P,
        r.corpo.x-0.21*Math.cos(aq)+0.19*Math.sin(aq),
        r.corpo.y-0.21*Math.sin(aq)-0.19*Math.cos(aq),r.corpo.z+0.47);
      this.comandante.setFrame(quadroSentado)
        .setPosition(assento.x,assento.y-salto+(sprite.pe[1]-LINHA_QUADRIL_SENTADO)*sprite.escala)
        .setDepth(profundidade(r.corpo.x+0.7,r.corpo.y+0.7)+0.25);   // over the whole rover: its frames are cut where the rover is in front (make_astronaut.py SENTADO)
      this.atualizarCarga();
      return;
    }
    const k = this.corpo;
    const escala = Math.abs(P.ez[1]) / 36;
    const pe = paraTela(P, k.x, k.y, k.z);
    const g = this.gAstronauta.clear();
    sombraAstronauta(g, pe, paraTela(P, k.x, k.y, sessao.terreno.altura(k.x, k.y)), escala);
    // Sprite: row = facing (8 directions), column 0 = standing, 1.. = Moon hop cycle.
    const v = Math.hypot(k.vx, k.vy);
    if (v > 0.3) this.direcao = (Math.round(Math.atan2(-k.vy, k.vx) / (Math.PI / 4)) + 8) % 8;
    const col = this.quadroPassada;
    this.comandante.setPosition(pe.x, pe.y);
    if(!this.mapa.visible || !this.astronautaProcedural.atualizar(this.comandante,k,sessao.mundo,sessao.carregando,this.direcao,this.passada.faseAtual,this.dtAstronauta,sessao.terreno.altura(k.x,k.y),P,sprite.escala))
      this.comandante.setFrame(this.direcao * sprite.colunas + col);
    const d = profundidade(k.x + 0.3, k.y + 0.3);
    g.setDepth(d - 1); this.comandante.setDepth(d);
    this.atualizarCarga();
  }
  // World-anchored inventory, with a stable readable size as the ground camera zooms.
  private atualizarCarga() {
    const n=sessao.carregando, zoom=this.cameras.main.zoom;
    const visivel=n>0 && this.comandante.visible;
    this.cargaHud.setVisible(visivel);
    if (!visivel) return;
    if (n!==this.ultimaCarga) {
      if (this.ultimaCarga>=0) this.cargaMudou=this.time.now;
      this.ultimaCarga=n;
      // One battery per battery in hand; past 5 the row would get too wide, so show one icon + "×N".
      const icones=n<=5?n:1, bw=12, gap=5, txtW=n>5?28:0;
      const W=icones*bw+(icones-1)*gap+txtW+18, H=30, x0=-W/2, topo=-H-7;
      const g=this.cargaFundo.clear();
      // Speech-bubble with a tail pointing down at the commander: "these are in my hands".
      g.fillStyle(0x020617,.35).fillRoundedRect(x0+2,topo+3,W,H,10);
      g.fillStyle(0x0b1a4a,.94).fillRoundedRect(x0,topo,W,H,10).fillTriangle(-6,-8,6,-8,0,0);
      g.lineStyle(2,0x7dd3fc).strokeRoundedRect(x0,topo,W,H,10);
      g.lineBetween(-6,-7,0,0).lineBetween(6,-7,0,0);
      g.fillStyle(0x0b1a4a).fillRect(-5,-9,10,3);
      for (let i=0;i<icones;i++) {
        const bx=x0+9+i*(bw+gap), by=topo+8;
        g.fillStyle(0xe2e8f0).fillRect(bx+3,by-2,bw-6,3).fillRoundedRect(bx,by,bw,17,2);
        g.fillStyle(0x4ade80).fillRect(bx+2,by+2,bw-4,13);
        g.fillStyle(0xfde047).fillTriangle(bx+7,by+3,bx+3,by+9,bx+6,by+9).fillTriangle(bx+6,by+8,bx+9,by+8,bx+5,by+14);
      }
      this.cargaTexto.setVisible(n>5).setText(`×${n}`).setPosition(x0+W-9-txtW/2,topo+H/2);
    }
    // Small pop when the count changes, so picking up / delivering a battery is noticed.
    const t=(this.time.now-this.cargaMudou)/260, pop=t>=0&&t<1?1+.22*Math.sin(t*Math.PI):1;
    this.cargaHud.setScale(pop/Math.max(.35,zoom)).setPosition(this.comandante.x,this.comandante.y-42-4/zoom).setDepth(900_001);

  }

}
