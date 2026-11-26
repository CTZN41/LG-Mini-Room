// Canonical models grouped by visible body and finish in the reviewed DB photographs.
const purifierProfiles=[
  ["hitCylinder", "white", ["AS153HWFS", "AS153HWWC", "AS171DWFC", "AS183HWFS", "AS183HWWA"]],
  ["flatLight", "white", ["AS156HWWC", "AS156HWWL", "AS186HWWA", "AS186HWWL", "AS105GWJC"]],
  ["round", "white", ["AS180DWFC", "AS181DWFC", "AS181DWPC", "AS183DWFC", "AS185DWWD", "AS190DWFA", "AS191DWFA", "AS193DWFA", "AS195DWWA", "AS155GWDL"]],
  ["round", "silver", ["AS190DNPR", "AS191DNPA"]],
  ["round", "taupe", ["AS192DSFA", "AS201NBFA", "AS202NB1A", "AS202NB2A", "AS202NS1A", "AS202NS2A", "AS203NB3A", "AS203NB4A", "AS203NS3A", "AS203NS4A", "AS204NS3A", "AS205NSJA"]],
  ["round", "taupe", ["AS206NSHA"], "dark"],
  ["round", "green", ["AS206NGHA"]],
  ["round", "green", ["AS202NG1A", "AS202NG2A", "AS204NG3A", "AS205NGJA"], "ring"],
  ["stackedHead", "white", ["AS235DWSA", "AS280DWFC", "AS281DWFC", "AS283DWFA", "AS283DWFC", "AS283DWFL", "AS285DWWA", "AS285DWWC", "AS285DWWD", "AS300DWFA", "AS301DWFA", "AS303DWFA", "AS305DWWA", "AS305DWWL"]],
  ["stackedHead", "silver", ["AS301DNPA", "AS309DNP", "AS331NNFC"]],
  ["stackedHead", "green", ["AS302DGFP", "AS334NG3C", "AS335NGAC", "AS351NGFA", "AS352NG1A", "AS352NG2A", "AS353NG3A", "AS353NG4A", "AS354NG3A", "AS354NG4A", "AS355NGNA"]],
  ["stackedHead", "green", ["AS356NGMA"], "dark"],
  ["stackedFlat", "white", ["AS309DWA"]],
  ["stackedHead", "taupe", ["AS336NSLC", "AS356NSHH", "AS356NSLL", "AS356NSMA"]],
  ["stackedHead", "taupe", ["AS322DSFA"], "pale"],
  ["stackedHead", "taupe", ["AS332NS2C", "AS333NS3C", "AS333NS4C", "AS334NS3C", "AS335NSAC", "AS352NB1A", "AS352NB2A", "AS352NS1A", "AS352NS2A", "AS353NB3A", "AS353NB4A", "AS353NS3A", "AS353NS4A", "AS354NS3A", "AS354NS3H", "AS354NS4A", "AS354NS4H", "AS355NSAH", "AS355NSEL", "AS355NSNA"], "ring"],
  ["stackedHead", "teal", ["AS352NM1A", "AS353NM3A", "AS353NM4A"]],
  ["stackedHead", "rose", ["AS352NP1A", "AS352NP2A", "AS353NP3A", "AS353NP4A"]],
  ["disc", "aqua", ["AS120VELA"]],
  ["grillePanel", "white", ["AS405BWRP"]],
  ["pocketCup", "bronze", ["AP111MGHA"]],
  ["pocket", "black", ["AP130MBKA"]],
  ["pocket", "white", ["AP130MWKA"]],
  ["miniCone", "white", ["AS076MWHC"]],
  ["table", "black", ["AS064PBBAR"]],
  ["table", "white", ["AS065SWHA", "AS062PWHAR", "AS062PWHAT", "AS063PWGCR", "AS064PWBAR", "AS065PWHA"]],
  ["catPerch", "white", ["AS065CWHA"]],
  ["tower", "green", ["FS061PGGC", "FS061PGHA", "FS061PGSA", "FS063PGDA", "FS064PGJA"]],
  ["tower", "wine", ["FS061PRHA", "FS061PRSA"]],
  ["tower", "sand", ["FS061PSHA", "FS063PBDA", "FS063PSCC", "FS063PSDA", "FS063PSGC", "FS063PSHA", "FS064PSJA", "FS065PSJC", "FS065PSKA"]],
  ["tower", "twoTone", ["FS062PZGA"]],
  ["table", "red", ["AS062PRHAR"]],
  ["table", "redWhite", ["AS062PRHWR", "AS062PRHWT"]],
  ["table", "redTop", ["AS062PWHRR", "AS062PWHRT"]],
  ["table", "yellowTop", ["AS062PWHYT"]],
  ["table", "yellow", ["AS062PYHAR", "AS062PYHAT"]],
  ["wallTall", "sand", ["AS185LGAA"]],
  ["wallSquare", "sand", ["AS185LSAA", "AS186LSAA"]],
  ["wallfit", "sand", ["AS356LSAA"]],
  ["hydro", "silver", ["HY856RNAA"]],
  ["hydro", "taupe", ["HY856RSAA"]]
];

const PurifierReview=(()=>{
  const shapes={
    grillePanel:'긴 스탠드형 본체와 전면 가로 격자',
    hitCylinder:'단층 원통 · 어두운 평면 그릴',flatLight:'단층 원통 · 밝은 평면 상단',
    round:'단층 원통 · 둥근 순환 헤드',stackedHead:'2단 원통 · 중간 띠와 둥근 순환 헤드',
    stackedFlat:'2단 원통 · 중간 띠와 평평한 상단',tower:'세로 슬롯과 긴 두 날개',
    table:'넓은 원형 상판과 좁은 받침',wallfit:'낮고 넓은 그릴과 짧은 다리',
    disc:'원형 전면과 낮은 받침',pocketCup:'작은 금속 원통과 비스듬한 상단',
    pocket:'길쭉한 휴대형 본체와 손목 끈',miniCone:'아래가 넓은 작은 본체',
    catPerch:'높은 그릇형 좌석과 옆의 낮은 발판',wallTall:'세로 그릴과 다리',
    wallSquare:'정사각에 가까운 전면 그릴',hydro:'긴 원통과 투명한 상부 수조'
  };
  const finishes={white:'흰색',silver:'은회색',taupe:'회갈색',green:'짙은 녹색',teal:'청록색',
    rose:'갈색빛 분홍',aqua:'연청색',bronze:'브론즈',black:'검정',wine:'적갈색',sand:'베이지',
    twoTone:'밝은 날개와 적갈색 하단',red:'붉은 상판과 본체',redWhite:'흰 상판과 붉은 본체',
    redTop:'붉은 상판과 회색 본체',yellowTop:'노란 상판과 회색 본체',yellow:'노란 상판과 황토색 본체'};
  const originals={hitCylinder:'white',round:'green',stackedHead:'taupe',tower:'sand',table:'white',wallfit:'sand'};
  const previous=new Map([
    ['AS206NGHA','round'],['FS064PSJA','tower'],['AS063PWGCR','table'],['AS356LSAA','wallfit'],
    ['AS153HWFS','hitCylinder'],['AS356NSMA','stackedHead']
  ]);
  const models=new Map();
  function spriteKey(shape,finish,head){
    if(shape==='hold')return 'db_purifier';
    if(shape==='hydro')return 'db_humid_'+finish;
    return 'db_purifier_'+shape+(originals[shape]===finish?'':'_'+finish)+(head?'_'+head:'');
  }
  for(const [shape,finish,codes,head] of purifierProfiles){
    const [w,d]=({table:[12,12],catPerch:[14,12],wallfit:[23,6],wallSquare:[15,5],wallTall:[13,5],hydro:[9,9],pocket:[4,4],pocketCup:[4,4]})[shape]||[8,8];
    for(const code of codes){
      const before=previous.has(code)?'db_purifier_'+previous.get(code):'db_purifier';
      const key=spriteKey(shape,finish,head);
      const held=shape==='hold';
      const decision=held?'사진 보류':before===key?'현재 도트 유지':'형태 수정';
      const reason=held?(code==='AS405BWRP'?'사진에 분리된 격자 면만 보여 본체 외곽 확인 필요':'덕트 연결 장치 사진으로 방 안에 노출되는 본체 형태 확인 필요'):
        shapes[shape]+' · '+finishes[finish]+(head==='ring'?' · 밝은 헤드 링':head==='dark'?' · 짙은 헤드':head==='pale'?' · 밝은 일체형 헤드 전면':'')+(code.includes(' + ')?' · 세트 사진의 공기청정기 본체':'');
      models.set(code,{shape,finish,w,d,spriteKey:key,decision,reason,before});
    }
  }
  return {models,spriteKey};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=PurifierReview;
