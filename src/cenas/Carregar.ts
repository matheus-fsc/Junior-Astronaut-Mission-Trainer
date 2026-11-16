// Generated with AI assistance (Claude). See README, "Use of AI tools".
// Loading screen: loads everything the game needs before it starts (terrain, modules, commander,
// sky, the live Moon's maps), with a live spinning Moon, a progress ring and real facts, so the
// first seconds of play are smooth. The flight film is not here: filme.ts downloads it in the
// background once the game runs.
import Phaser from 'phaser';
import { movimentoReduzido } from '../video';
import { fonte, dadosTerreno, sessao } from './sessao';
import { carregarImagensMundo } from './irParaMarte';
import { carregarLua, criarLua, LADO } from './luaShader';
import { giroEm } from './globo';
import modelos from '../dados/modulos.json';
import { carregarRover } from './desenharRover';
import rotacoesModulos from '../dados/rotacoesModulos.json';
import bandeiras from '../dados/bandeiras.json';
import bandeiraMarte from '../dados/bandeira_marte.json';
import sprite from '../dados/astronauta.json';
import dadosViagem from '../dados/viagem.json';
import planetas3d from '../dados/planetas3d.json';
import { ACESSORIOS, chaveAcessorio } from '../dados/acessorios';
import { SKINS_SPRITES, chaveSkin, chaveSkinSentado, arquivoSentado, chaveSkinCarga, arquivoSkinCarga } from '../dados/skins';
import constelacoes from '../dados/constelacoes.json';
import { ICONES, chaveIcone } from '../dados/icones';
import { soltarTeclasAoPerderFoco } from '../foco';

const FATOS = [
  'The ground in this game is real: NASA\'s LRO spacecraft measured it with a laser.',
  'Your base sits on the rim of Shackleton crater, near the Moon\'s south pole.',
  'On the Moon you weigh one sixth of what you weigh on Earth.',
  'At the lunar south pole the Sun never climbs high: it circles the horizon.',
  'The stars you will see are in their real places, from NASA star maps.',
];

const GIRO_INICIAL = giroEm(Date.parse('2024-05-05T12:00:00Z'));

export class Carregar extends Phaser.Scene {
  private luaPreview: ReturnType<typeof criarLua> | null = null;
  private luaPlaceholder!: Phaser.GameObjects.Graphics;
  private anel!: Phaser.GameObjects.Graphics;
  private progresso!: Phaser.GameObjects.Text;
  private giro = GIRO_INICIAL;

  constructor() {
    super({ key: 'Carregar', active: true });
  }

  preload() {
    const W = this.scale.width, H = this.scale.height;
    const u = Phaser.Math.Clamp(Math.min(W / 1100, H / 650), 0.45, 1.4);
    const cx = W / 2, cy = H * 0.44;
    const diametro = Math.min(W * 0.46, H * 0.34, 300 * u);
    const raio = diametro / 2;
    const raioAnel = raio + 14 * u;
    const tituloY = Math.max(H * 0.10, cy - raioAnel - 90 * u);
    const progressoY = cy + raioAnel + 16 * u;

    // Match the illustrated blue mission menu; no external image is needed to show loading.
    const fundo = this.textures.createCanvas('loadingMissionBackdrop', 32, 256);
    if (fundo) {
      const ctx = fundo.context, grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, '#142864'); grad.addColorStop(0.5, '#214bb7'); grad.addColorStop(1, '#102457');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, 32, 256); fundo.refresh();
      this.add.image(0, 0, 'loadingMissionBackdrop').setOrigin(0).setDisplaySize(W,H).setDepth(-100);
    } else this.add.rectangle(0,0,W,H,0x173b91).setOrigin(0).setDepth(-100);

    const rnd = new Phaser.Math.RandomDataGenerator(['lunar-odyssey-loading']);
    const ceu = this.add.graphics().setDepth(-90);
    ceu.lineStyle(Math.max(1,u),0x93c5fd,0.12);
    for (const r of [0.38,0.62,0.88]) ceu.strokeCircle(cx,cy,Math.max(W,H)*r);
    ceu.lineStyle(1,0x93c5fd,0.07).lineBetween(cx,0,cx,H).lineBetween(0,cy,W,cy);
    for (let i = 0; i < 90; i++) {
      const x = rnd.between(0, W), y = rnd.between(0, H);
      ceu.fillStyle(0xffffff, rnd.realInRange(0.08, 0.55)).fillCircle(x, y, rnd.realInRange(0.4, 1.4) * u);
    }

    const chaveBrilho = 'brilhoCarregamento';
    if (!this.textures.exists(chaveBrilho)) {
      const textura = this.textures.createCanvas(chaveBrilho, 256, 256);
      if (textura) {
        const ctx = textura.context;
        const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        grad.addColorStop(0, 'rgba(125, 211, 252, 0.24)');
        grad.addColorStop(0.45, 'rgba(96, 165, 250, 0.07)');
        grad.addColorStop(1, 'rgba(96, 165, 250, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);
        textura.refresh();
      }
    }
    if (this.textures.exists(chaveBrilho)) {
      this.add.image(cx, cy, chaveBrilho).setDisplaySize(diametro * 2.4, diametro * 2.4).setDepth(-80);
    }

    this.luaPlaceholder = this.add.graphics().setDepth(-70);
    this.luaPlaceholder.fillStyle(0x1e293b).fillCircle(cx, cy, raio);
    this.luaPlaceholder.lineStyle(2 * u, 0x334155, 0.85).strokeCircle(cx, cy, raio);

    const orbite = this.add.graphics().setDepth(-75);
    orbite.fillStyle(0x0b1a4a,0.32).fillCircle(cx,cy+4*u,raioAnel+12*u);
    orbite.lineStyle(2*u,0x7dd3fc,0.35).strokeCircle(cx,cy,raioAnel+11*u);
    for (let k=0;k<36;k++) {
      const a=k*Math.PI/18,r=raioAnel+11*u;
      orbite.lineStyle(k%3===0?2*u:u,0xbfdbfe,k%3===0?0.6:0.2)
        .lineBetween(cx+Math.cos(a)*r,cy+Math.sin(a)*r,cx+Math.cos(a)*(r+4*u),cy+Math.sin(a)*(r+4*u));
    }
    this.anel = this.add.graphics().setDepth(-50);
    const badge=this.add.graphics().setDepth(0);
    badge.fillStyle(0x0b1a4a).fillRoundedRect(cx-48*u,progressoY-14*u+4*u,96*u,28*u,14*u);
    badge.fillStyle(0x22c55e).fillRoundedRect(cx-48*u,progressoY-14*u,96*u,28*u,14*u);
    badge.lineStyle(2*u,0xffffff).strokeRoundedRect(cx-48*u,progressoY-14*u,96*u,28*u,14*u);
    this.progresso = this.add.text(cx, progressoY, '0%', fonte(Math.max(13,17*u), '#ffffff', { fontStyle: 'bold', stroke:'#166534',strokeThickness:2*u })).setOrigin(0.5).setDepth(1);

    const logoSize=Math.min(50*u,W/10.5);
    this.add.text(cx+3*u,tituloY+4*u,'LUNAR ODYSSEY',fonte(logoSize,'#0b1a4a',{
      fontStyle:'bold',stroke:'#0b1a4a',strokeThickness:logoSize/4.5,
    })).setOrigin(0.5);
    this.add.text(cx,tituloY,'LUNAR ODYSSEY',fonte(logoSize,'#fde047',{
      fontStyle:'bold',stroke:'#1e293b',strokeThickness:logoSize/4.5,
    })).setOrigin(0.5);
    const faixaY=tituloY+logoSize*0.85,fw=Math.min(W-32,280*u);
    this.add.graphics().fillStyle(0x0b1a4a).fillRoundedRect(cx-fw/2,faixaY-12*u,fw,24*u,12*u);
    this.add.text(cx,faixaY,'PREPARING THE MISSION',fonte(Math.max(10,12*u),'#ffffff',{fontStyle:'bold'})).setOrigin(0.5);
    const status=this.add.text(cx,progressoY+29*u,'Loading mission assets',fonte(Math.max(11,13*u),'#dbeafe')).setOrigin(0.5);
    const cardW=Math.min(W-32,620*u),cardH=Math.max(78,96*u);
    const cardY=Math.min(H-cardH-16*u,Math.max(H*0.73,progressoY+52*u));
    const card=this.add.graphics();
    card.fillStyle(0x0b1a4a,0.5).fillRoundedRect(cx-cardW/2,cardY+5*u,cardW,cardH,18*u);
    card.fillStyle(0x102657,0.96).fillRoundedRect(cx-cardW/2,cardY,cardW,cardH,18*u);
    card.lineStyle(2*u,0x7dd3fc,0.85).strokeRoundedRect(cx-cardW/2,cardY,cardW,cardH,18*u);
    this.add.text(cx,cardY+18*u,'DID YOU KNOW?',fonte(Math.max(10,12*u),'#fde047',{fontStyle:'bold'})).setOrigin(0.5);
    const fato=this.add.text(cx,cardY+38*u,FATOS[0],fonte(Math.max(11,15*u),'#ffffff',{
      align:'center',wordWrap:{width:cardW-32*u},lineSpacing:2*u,
    })).setOrigin(0.5,0);
    let i = 0;
    this.time.addEvent({ delay: 3200, loop: true, callback: () => fato.setText(FATOS[++i % FATOS.length]) });

    const desenhar = (p: number) => {
      this.giro = GIRO_INICIAL + (movimentoReduzido() ? 0 : p * 120);
      this.luaPreview?.setGiro(this.giro);
      this.anel.clear();
      this.anel.lineStyle(6 * u, 0x0b1a4a, 0.95).strokeCircle(cx, cy, raioAnel);
      this.anel.lineStyle(5 * u, 0xfde047, 1);
      this.anel.beginPath();
      this.anel.arc(cx, cy, raioAnel, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p, false);
      this.anel.strokePath();
      const ang = -Math.PI / 2 + Math.PI * 2 * p;
      this.anel.fillStyle(0xf8fafc, 1).fillCircle(cx + Math.cos(ang) * raioAnel, cy + Math.sin(ang) * raioAnel, 2.5 * u);
      this.progresso.setText(`${Math.round(p * 100)}%`);
      status.setText(p < 1 ? 'Loading mission assets' : 'Preparing your base');
    };
    desenhar(0);
    this.load.on('progress', desenhar);

    carregarLua(this);
    this.load.image('terreno', dadosTerreno.imagem.arquivo);
    for (const [id, m] of Object.entries(modelos)) this.load.image(`mod_${id}`, m.arquivo);
    for (const [id, m] of Object.entries(rotacoesModulos) as [string,{arquivo:string}][]) this.load.image(`mod_${id}`, m.arquivo);
    for (const sk of SKINS_SPRITES) this.load.spritesheet(chaveSkinCarga(sk.id), arquivoSkinCarga(sk.id), { frameWidth: sprite.frame, frameHeight: sprite.frame });
    this.load.image('foguete_voo', 'lua/modulos/foguete_voo.png');   // launch film and landing (Chegada.ts)
    carregarRover(this.load);   // the Apollo LRV in 16 headings (desenharRover.ts)
    for (const [id, b] of Object.entries(bandeiras)) this.load.image(`bandeira_${id}`, b.arquivo);
    // The waving Mars flag on the rocket's progress bar (make_bandeira_progresso.py).
    this.load.spritesheet('bandeira_marte_hud', bandeiraMarte.arquivo, { frameWidth: bandeiraMarte.w, frameHeight: bandeiraMarte.h });
    for (const a of ACESSORIOS) this.load.spritesheet(chaveAcessorio(a.id), a.arquivo, { frameWidth: sprite.frame, frameHeight: sprite.frame });
    // Explorer 3D has no sheets of its own: it uses the commander's (SKINS_SPRITES leaves it out).
    for (const sk of SKINS_SPRITES) this.load.spritesheet(chaveSkin(sk.id), sk.arquivo, { frameWidth: sprite.frame, frameHeight: sprite.frame });
    for (const sk of SKINS_SPRITES) this.load.spritesheet(chaveSkinSentado(sk.id), arquivoSentado(sk.arquivo), { frameWidth: sprite.frame, frameHeight: sprite.frame });
    this.load.image('viagem_foguete', dadosViagem.foguete.arquivo);
    // The Mars ship, 16 headings (128 KB in all): it waits in lunar orbit after liftoff (Espaco).
    dadosViagem.nave.direcoes.forEach((n, k) => this.load.image(`nave_d${k}`, n.arquivo));
    this.load.image('planeta_marte', 'lua/planetas/marte.png');   // live Mars in the solar system view
    this.load.image('ceu', 'lua/sky.jpg');
    // The real sky behind the solar system view, the ship and Mars from space (make_ceu.py), the
    // planets as Blender models lit from 16 sides (make_planetas_3d.py) and the Sun (make_sun.py).
    this.load.image('ceu_sistema', 'lua/sky_sistema.jpg');
    // The small sheets (rotation x light direction) for the solar system view; the big ones load
    // when a body is opened full screen (Astro).
    for (const [nome, p] of Object.entries(planetas3d)) {
      if (nome === 'nota') continue;
      const q = (p as { pequeno: { arquivo: string; quadro: number } }).pequeno;
      this.load.spritesheet(`pl3d_${nome}`, q.arquivo, { frameWidth: q.quadro, frameHeight: q.quadro });
    }
    // The big Sun of the farther zoom stops (make_planetas_3d.py, 288 px frames).
    const solMedio = (planetas3d as unknown as { sol: { medio: { arquivo: string; quadro: number } } }).sol.medio;
    this.load.spritesheet('pl3d_sol_m', solMedio.arquivo, { frameWidth: solMedio.quadro, frameHeight: solMedio.quadro });
    constelacoes.forEach((c, k) => this.load.image(`const${k}`, c.arquivo));
    for (const [id, arquivo] of Object.entries(ICONES)) this.load.image(chaveIcone(id as keyof typeof ICONES), arquivo);

    const criarPreview = () => {
      if (this.luaPreview || !this.textures.exists('luaAlbedo') || !this.textures.exists('luaAltura')) return;
      this.luaPlaceholder.setVisible(false);
      this.luaPreview = criarLua(this, cx, cy);
      this.luaPreview.setScale(diametro / LADO).setDepth(-60).setGiro(this.giro);
    };
    this.load.on('filecomplete', criarPreview);
  }

  update(_time: number, delta: number) {
    if (!this.luaPreview || movimentoReduzido()) return;
    this.giro = (this.giro + delta * 0.012) % 360;
    this.luaPreview.setGiro(this.giro);
  }

  create() {
    soltarTeclasAoPerderFoco(this.game);   // keys held when the window loses focus are let go
    sessao.restaurarPartida();
    carregarImagensMundo(this,sessao.mundo,()=>this.iniciarCenas());
  }

  private iniciarCenas() {
    this.scene.launch('Espaco');
    this.scene.launch('Superficie');
    this.scene.launch('Interface');
    this.scene.bringToTop();
    const salvar=()=>sessao.salvar();
    window.addEventListener('pagehide',salvar);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)salvar();});
    let parou = false;
    const parar = () => {
      if (parou) return;
      parou = true;
      if (this.scene.isActive()) this.scene.stop();
    };
    this.cameras.main.fadeOut(450, 5, 7, 15);
    this.cameras.main.once('camerafadeoutcomplete', parar);
    window.setTimeout(parar, 1200);
  }
}
