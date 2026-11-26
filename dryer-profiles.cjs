// Canonical dryer photos. Each row keeps its previous sprite key for the review history.
const profiles=[
  ["blackGlass", "beige", "body:dryer:beige:beige:blackGlass", ["RD19ENC"]],
  ["blackGlass", "beige", "body:dryer:beige:beige:", ["RD19ESC", "RD21ENC", "RD21ESC"]],
  ["blackGlass", "green", "body:dryer:green:green:", ["RD19GNC", "RD19GSC", "RD21GNC", "RD21GSC"]],
  ["blackGlass", "white", "body:dryer:white:white:", ["RD19WNC", "RD19WSC", "RD21WNC", "RD21WSC"]],
  ["panelGlass", "beige", "body:dryer:beige:beige:", ["RD20EN", "RD20ENE", "RD20ENER", "RD20ES", "RD21EN", "RD21ES", "RD21ESE", "RD21ESER", "RG18EN", "RG19EN", "RG20EN"]],
  ["panelGlass", "green", "body:dryer:green:green:", ["RD20GNG", "RD20GNGR", "RD20GS", "RD21GN", "RD21GS", "RD21GSG", "RD21GSGR", "RG18GN", "RG19GN", "RG20GN"]],
  ["panelGlass", "green", "body:dryer:neutral:neutral:", ["RD20GNGX", "RD20GNGXR"]],
  ["panelGlass", "black", "body:dryer:black:black:", ["RD20KN", "RD20KNR", "RD20KNT", "RD20KNTR", "RG19KN", "RG20KN"]],
  ["panelGlass", "silver", "body:dryer:silver:silver:", ["RD20VNT", "RG18VN", "RG19VN", "RG19VNS", "RG20VN"]],
  ["panelGlass", "white", "body:dryer:white:white:", ["RD20WN", "RD20WNR", "RD21WS", "RG18WN", "RG18WNST", "RG18WNT", "RG18WNWT", "RG19WN", "RG20WN"]],
  ["panelGlass", "white", "body:dryer:neutral:neutral:", ["RG18WNW"]],
  ["rackBase", "beige", "body:dryer:neutral:neutral:", ["RD20ENEF", "RG20ENF"]],
  ["rackBase", "green", "body:dryer:neutral:neutral:", ["RD20GNGF", "RG20GNF"]],
  ["rackBase", "white", "body:dryer:neutral:neutral:", ["RG18WNTF", "RG18WNWTF"]],
  ["drawerBase", "beige", "body:dryer:neutral:neutral:", ["RD20ENEX", "RD21ESEFX", "RG18ENX", "RG19ENX", "RG20ENX"]],
  ["drawerBase", "black", "body:dryer:neutral:neutral:", ["RD20KNX", "RG20KNX"]],
  ["drawerBase", "silver", "body:dryer:neutral:neutral:", ["RD20VNX", "RG18VNX", "RG19VNX", "RG20VNX"]],
  ["drawerBase", "white", "body:dryer:neutral:neutral:", ["RD20WNAX", "RG18WNWTX", "RG19WNX"]],
  ["drawerBase", "green", "body:dryer:neutral:neutral:", ["RG19GNX", "RG20GNX"]],
  ["closedBase", "white", "body:dryer:neutral:neutral:", ["RD21WSX"]],
  ["closedBase", "black", "body:dryer:neutral:neutral:", ["RG19KNX"]],
  ["brightDrum", "black", "body:dryer:black:black:", ["RD20KNA", "RD21KS"]],
  ["brightDrum", "silver", "body:dryer:silver:silver:", ["RD20VN", "RD20VNA", "RD20VNR", "RD20VSQ", "RD21VS"]],
  ["brightDrum", "white", "body:dryer:white:white:", ["RD20WNA", "RD20WS", "RD20WSQ", "RD20WSQR"]],
  ["displayHatch", "beige", "body:dryer:beige:beige:", ["RD22ES", "RD22ESE", "RD25ESE", "RD25ESER", "RD25ESR"]],
  ["displayHatch", "beige", "body:dryer:neutral:neutral:", ["RD25ES"]],
  ["displayHatch", "green", "body:dryer:green:green:", ["RD22GS", "RD22GSG", "RD25GS", "RD25GSG", "RD25GSGR", "RD25GSR"]],
  ["displayHatch", "black", "body:dryer:black:black:", ["RD22KS", "RD25KS", "RD25KSR"]],
  ["displayHatch", "silver", "body:dryer:silver:silver:", ["RD22VS", "RD25VS", "RD25VSR"]],
  ["displayHatch", "white", "body:dryer:white:white:", ["RD22WS", "RD25IS", "RD25ISR"]],
  ["displayHatch", "almond", "body:dryer:beige:beige:", ["RD25AS", "RD25ASR"]],
  ["displayHatch", "taupe", "body:dryer:brown:brown:", ["RD25TS", "RD25TSR"]],
  ["meshDoor", "silver", "body:dryer:silver:silver:", ["RH10VTA", "RH9VV"]],
  ["meshDoor", "white", "body:dryer:white:white:", ["RH10WTA", "RH10WTW", "RH9WV", "RH9WVWB"]],
  ["smokedDoor", "white", "body:dryer:neutral:neutral:", ["RH16WTAN"]],
  ["smokedDoor", "beige", "body:dryer:beige:beige:", ["RH17ETE", "RH17HT"]],
  ["smokedDoor", "black", "body:dryer:black:black:", ["RH17KTA"]],
  ["smokedDoor", "silver", "body:dryer:silver:silver:", ["RH17VTA", "RH17VTS"]],
  ["chromeRim", "silver", "body:dryer:silver:silver:", ["RH18VTAN", "RH18VTLN", "RH19VTAN", "RH19VTLN", "RH19VTSN"]],
  ["chromeRim", "white", "body:dryer:white:white:", ["RH18WTLN", "RH18WTSN", "RH19WTAN", "RH19WTLN", "RH19WTWN"]],
  ["chromeRim", "black", "body:dryer:black:black:", ["RH19KTAN"]],
  ["coinPanel", "silver", "body:dryer:neutral:neutral:", ["RN12SBD", "RN12SBF"]],
  ["steelConsole", "silver", "body:dryer:neutral:neutral:", ["RV1029C4T"]],
  ["hold", "neutral", "body:dryer:neutral:neutral:", ["RV1029C4T/C7T"]],
  ["raisedControl", "silver", "body:dryer:neutral:neutral:", ["RV1029CN4T"]],
  ["raisedControl", "silver", "body:dryer:silver:silver:raisedControl", ["RV12SBD"]]
];

const descriptions={
  blackGlass:'중앙 다이얼 · 짙은 유리 도어 · 오른쪽 하단 덮개',
  panelGlass:'중앙 다이얼과 우측 표시창 · 검은 도어 · 평평한 하단',
  displayHatch:'우측 표시창 · 넓은 검은 도어 · 오른쪽 하단 덮개',
  brightDrum:'검은 테두리 안 밝은 드럼 · 우측 표시창',
  rackBase:'본체 아래 열린 받침과 가로 격자',
  drawerBase:'본체 아래 당겨진 서랍과 짙은 원형 창',
  closedBase:'본체 아래 닫힌 하부 모듈과 수평 이음선',
  meshDoor:'짙은 원형 창 안의 세 갈래 윤곽 · 분리된 상단 조작부',
  smokedDoor:'어둡게 비치는 도어 안쪽과 세로 손잡이 · 상단 조작부',
  chromeRim:'얇고 밝은 도어 테두리 · 위쪽 가로 조작부',
  coinPanel:'상단 모서리의 사각 패널 · 굵은 금속 도어 링 · 하단 덮개',
  steelConsole:'가로형 금속 조작부 · 굵은 은색 도어 링',
  raisedControl:'은색 도어 링 · 오른쪽 상단 돌출부',
  hold:'대표 사진에 본체 두 대가 보이며 구성 모델이 개별 등록되지 않아 외형 판정 보류'
};
const models=new Map();
for(const [detail,tone,before,codes] of profiles){
  for(const code of codes){
    const key=detail==='hold'?before:['body','dryer',tone,tone,detail].join(':');
    const decision=detail==='hold'?'사진 보류':key===before?'현재 도트 유지':'형태 수정';
    const reason=descriptions[detail]+(code==='RD20GNGX'?' · 옆에 놓인 모듈은 구성 모델 미확인으로 본체만 표현':'');
    models.set(code,{detail,tone,before,key,decision,reason});
  }
}
module.exports={models};
