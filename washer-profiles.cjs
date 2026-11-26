// Visual details from the canonical DB photos. Sale codes retain independent inventory keys.
// A set inherits its primary unit's details, including when its photograph shows multiple units.
function index(groups){
  const result=new Map();
  for(const [value,codes] of Object.entries(groups))for(const code of codes)result.set(code,value);
  return result;
}
const fronts=index({
  clearLid: ["T16DU", "T17WT", "TR12HN", "TR15MV5", "TR15WV5", "TR16DK", "TR16VK", "TR16WK3"],
  paleLid: ["T15WUA", "T18WX7", "T18WX7Y", "T20VVD", "T20WT", "TR16WK"],
  consoleLid: [
    "T18PZ7", "T19OZ0", "T21EZ0", "T21EZ9", "T21GZ9", "T21OZ0", "T22PZ9", "T23EZ9", "T23OZ9", "T25OZ0",
    "TA21PZ9", "TA23PZ9", "TA25GZ9"
  ],
  coinDoor: ["F13SED", "F17SED"],
  chromeDoor: [
    "F13SEE", "F17SEE", "F19WDBU", "F19WDBUX", "F19WDWP", "F19WDWPR", "F19WDWPX", "F9WK", "F9WKA",
    "F9WKB", "F9WKBY", "F9WP", "F9WPA", "F9WPB", "F9WPBY", "F9WTBQ", "F9WTQ", "FR9WK", "FR9WKB",
    "FR9WP", "FR9WPB"
  ],
  opaqueDoor: [
    "F17CTP", "F17CTPR", "F17HTP", "F17HTPR", "F17ITP", "F17ITPR", "F17NTP", "F17NTPR", "F9WT", "F9WTB",
    "FY9WT", "FY9WTB"
  ],
  wideBand: [
    "F21VDAPX", "FC2521EQ6C", "FC2521IQ6C", "FC2521KX6C", "FC2521SX6C", "FC2521TX6C", "FC2521UX6C",
    "FG19EN", "FG19ENR", "FG21EN", "FG21ENR", "FG24EN", "FG24ENF", "FG24ENX", "FG24GN", "FG24GNF",
    "FG24GNX", "FX23EN", "FX23ENE", "FX23ENER", "FX24ENE", "FX24ENER", "FX24ES", "FX25EAR", "FX25EF",
    "FX25EFE", "FX25ENR", "FX25ES", "FX25ESER", "FX25ESR"
  ],
  towerThin: [
    "W2520WHM", "W2520WZM", "WA2323EEHN", "WA2323EEZN", "WA2323EGHN", "WA2323EGZN", "WA2323EGZNR",
    "WA2323GEHN", "WA2323GEZN", "WA2323GGHN", "WA2323GGZN", "WA2323IIAN", "WA2525EEHF", "WA2525EEZF",
    "WA2525EGHF", "WA2525EGP6R", "WA2525EGP6Z", "WA2525EGZF", "WA2525EMZF", "WA2525EYZF", "WA2525GEHF",
    "WA2525GEP6H", "WA2525GEP6R", "WA2525GEZF", "WA2525GGHF", "WA2525GGZF", "WA2525GMZF", "WA2525GYZF",
    "WA2525IIHF", "WA2525IIHFR", "WA2525KDF", "WA2525KDFR", "WA2525MEZF", "WA2525MGZF", "WA2525MMHF",
    "WA2525MMZF", "WA2525MYHF", "WA2525MYZF", "WA2525SSP6G", "WA2525SSP6R", "WA2525TAP6Z",
    "WA2525TTP6R", "WA2525TTP6Z", "WA2525UUP6G", "WA2525UUP6R", "WA2525YEZF", "WA2525YGZF",
    "WA2525YMHF", "WA2525YMP6G", "WA2525YMP6R", "WA2525YMZF", "WA2525YYHF", "WA2525YYZF", "WL21WDU",
    "WL22EEHU", "WL22EEZU", "WL22EGHU", "WL22EGZU", "WL22EMHU", "WL22EMZU", "WL22EYHU", "WL22EYZU",
    "WL22GEHU", "WL22GEZU", "WL22GGHU", "WL22GGZU", "WL22GMHU", "WL22GMZU", "WL22GYHU", "WL22GYZU",
    "WL22KDU", "WL22MEHU", "WL22MEZU", "WL22MGHU", "WL22MGZU", "WL22MMHU", "WL22MMZU", "WL22MYHU",
    "WL22MYZU", "WL22WDU", "WL22YEHU", "WL22YEZU", "WL22YGHU", "WL22YGZU", "WL22YMHU", "WL22YMZU",
    "WL22YYHU", "WL22YYZU", "WL2521WDUR", "WL2522EGZUR"
  ]
});
const basePanels=new Set([
  "F24WDWPX", "FC2521EQ6C", "FC2521IQ6C", "FC2521KX6C", "FC2521SX6C", "FC2521TX6C", "FC2521UX6C",
  "FG24ENF", "FG24GNF", "FH11EA", "FH25EA", "FH25ES", "FH25ESE", "FH25GS", "FH25GSG", "FH25WA",
  "FX23GNGF", "FX25EARF", "FX25EARX", "FX25ENRF", "FX25ENRX", "FX25GARF", "FX25GARX", "FX25GNRF",
  "FX25GNRX"
]);
const photoColors=index({
  white: [
    "F19WDBU", "F19WDBUX", "F19WDLPX", "F19WDWPX", "F21WDAX", "F21WDLPX", "F24WDLPX", "F24WDWPX",
    "F9WK", "F9WKA", "F9WKB", "F9WKBY", "FG21WNX", "FR9WK", "FR9WKB", "FX23WNAX", "FX24WNX", "T17WT",
    "TR10WV4", "TR12HN", "TR13WV4", "TR13WV4Q"
  ],
  silver: [
    "F13SED", "F17SED", "F17SEE", "F21VDAPX", "F21VDU", "FG24VNSX", "FH25LMTH", "FX23VNAX", "FX23VNX",
    "T15DT", "T18DX7Y", "T19DX7AY", "T19DX7Y", "TR13MV4", "W17VTA"
  ],
  black: ["F15SQAM", "FG21KN", "FG21KNR", "FG24KNX", "T18MTV", "T18MX7AY", "T18MX7Y", "T19MX7Y", "T20MT"],
  brown: ["F13SEE"],
  beige: ["FG21ENX", "FG24EN", "FX23ENEX", "FX25EARF", "FX25ENRF"],
  green: ["FG19GNX", "FG24GN", "FX23GNGX", "FX25GARF", "FX25GNRF"]
});
// Missing cabinet colours on two otherwise identical top-loader photos.
photoColors.set('T18WX7Y','white');
photoColors.set('T19MX7AY','black');
const descriptions={
  smokeLid:'짙은 상단 유리 뚜껑',clearLid:'밝은 테두리의 투명 상단 뚜껑',paleLid:'밝은색 상단 덮개',
  consoleLid:'뒤로 솟은 조작부와 짙은 뚜껑',coinDoor:'상단 돌출 결제부와 밝은 도어 링',
  chromeDoor:'밝은 금속 도어 링',opaqueDoor:'내부가 가려진 짙은 원형 도어',wideBand:'전면 상단 띠와 둥근 유리문',
  glassDoor:'짙은 전면 유리문과 상단 조작부',towerBand:'두 원형 도어 사이 가로 조작부',
  towerThin:'두 원형 도어와 좁은 중앙 이음선',compactDoor:'낮은 본체와 전면 원형 도어'
};
function profile(code,shape,upper,lower){
  const tower=shape==='tower';
  const fallback=tower?'towerBand':shape==='top'?'smokeLid':shape==='small'?'compactDoor':'glassDoor';
  const style=fronts.get(code)||fallback;
  const panel=basePanels.has(code)&&!['twin','comboMini'].includes(shape);
  const tone=photoColors.get(code)||upper;
  return {upper:tone,lower:tower?(photoColors.get(code)||lower):tone,detail:style+(panel?'+base':''),
    reason:descriptions[style]+(panel?' · 하단 분리선':'')};
}
module.exports={profile};
