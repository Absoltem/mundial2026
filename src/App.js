import { useState, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection } from "firebase/firestore";

// ============================================================
// FIREBASE
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyC2OAZrZq0Zal3BFquk3fm_LYFjKVTllNk",
  authDomain: "quiniela-lola.firebaseapp.com",
  projectId: "quiniela-lola",
  storageBucket: "quiniela-lola.firebasestorage.app",
  messagingSenderId: "1090831350494",
  appId: "1:1090831350494:web:f7380ed9ff7f50a7ae204f"
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// ============================================================
// API KEYS
// ============================================================
// (No API key needed — ESPN's public scoreboard endpoint is used)

// ============================================================
// TEAM VALUES (Poisson difficulty)
// ============================================================
const TEAM_VALUES = {
  "México":113.5,"Sudáfrica":26,"Corea del Sur":73.3,"República Checa":88,
  "Canadá":120,"Bosnia y Herzegovina":80,"Catar":15,"Suiza":130,
  "Brasil":620,"Marruecos":290,"Haití":8,"Escocia":95,
  "Estados Unidos":220,"Paraguay":55,"Australia":40,"Turquía":215,
  "Alemania":560,"Curazao":12,"Costa de Marfil":230,"Ecuador":200,
  "Países Bajos":430,"Japón":130,"Suecia":180,"Túnez":30,
  "Bélgica":310,"Egipto":85,"Irán":15,"Nueva Zelanda":14,
  "España":730,"Cabo Verde":10,"Arabia Saudí":25,"Uruguay":120,
  "Francia":760,"Senegal":175,"Irak":8,"Noruega":320,
  "Argentina":520,"Argelia":95,"Austria":120,"Jordania":8,
  "Portugal":580,"RD Congo":45,"Uzbekistán":65,"Colombia":175,
  "Inglaterra":650,"Croacia":140,"Ghana":70,"Panamá":20,
};

const TEAM_ALIASES = {
  "México":["Mexico"],"Sudáfrica":["South Africa"],"Corea del Sur":["South Korea","Korea Republic"],
  "República Checa":["Czech Republic","Czechia"],"Canadá":["Canada"],
  "Bosnia y Herzegovina":["Bosnia and Herzegovina","Bosnia & Herzegovina"],
  "Catar":["Qatar"],"Suiza":["Switzerland"],"Brasil":["Brazil"],
  "Marruecos":["Morocco"],"Haití":["Haiti"],"Escocia":["Scotland"],
  "Estados Unidos":["USA","United States"],"Paraguay":["Paraguay"],
  "Australia":["Australia"],"Turquía":["Turkey","Türkiye"],
  "Alemania":["Germany"],"Curazao":["Curacao","Curaçao"],
  "Costa de Marfil":["Ivory Coast","Cote d'Ivoire"],"Ecuador":["Ecuador"],
  "Países Bajos":["Netherlands","Holland"],"Japón":["Japan"],
  "Suecia":["Sweden"],"Túnez":["Tunisia"],"Bélgica":["Belgium"],
  "Egipto":["Egypt"],"Irán":["Iran"],"Nueva Zelanda":["New Zealand"],
  "España":["Spain"],"Cabo Verde":["Cape Verde"],"Arabia Saudí":["Saudi Arabia"],
  "Uruguay":["Uruguay"],"Francia":["France"],"Senegal":["Senegal"],
  "Irak":["Iraq"],"Noruega":["Norway"],"Argentina":["Argentina"],
  "Argelia":["Algeria"],"Austria":["Austria"],"Jordania":["Jordan"],
  "Portugal":["Portugal"],"RD Congo":["DR Congo","Congo DR","Democratic Republic of Congo"],
  "Uzbekistán":["Uzbekistan"],"Colombia":["Colombia"],
  "Inglaterra":["England"],"Croacia":["Croatia"],"Ghana":["Ghana"],"Panamá":["Panama"],
};

// ============================================================
// SCORING
// ============================================================
const FP = { goalGK:12,goalDEF:7,goalMID:5,goalFWD:4,assist:3,cleanSheet:4,penaltySave:5,yellow:-1,penaltyMiss:-2,ownGoal:-3,red:-4 };

function posPoints(pos,goals,assists,cleanSheet,yellow,red,penaltySave,penaltyMiss,ownGoals){
  const gPts = pos==="POR"?goals*FP.goalGK:pos==="DEF"?goals*FP.goalDEF:pos==="MED"?goals*FP.goalMID:goals*FP.goalFWD;
  const csPts = cleanSheet&&(pos==="POR"||pos==="DEF")?FP.cleanSheet:0;
  return gPts+assists*FP.assist+csPts+yellow*FP.yellow+red*FP.red+penaltySave*FP.penaltySave+penaltyMiss*FP.penaltyMiss+ownGoals*FP.ownGoal;
}

function getResult(h,a){ if(h===null||a===null||h===undefined||a===undefined)return null; return h>a?"home":h<a?"away":"draw"; }

function getQuinielaPoints(homeVal,awayVal,actualResult,predResult,ah,aa,ph,pa){
  if(!actualResult||actualResult!==predResult)return 0;
  const ratio=homeVal/(homeVal+awayVal);
  let base=0;
  if(actualResult==="home")base=ratio>0.55?1:ratio<0.45?5:3;
  else if(actualResult==="draw")base=3;
  else base=ratio<0.45?1:ratio>0.55?5:3;
  return base+(ah===ph&&aa===pa?3:0);
}

function norm(s){ return(s||"").toLowerCase().replace(/[áàä]/g,"a").replace(/[éèë]/g,"e").replace(/[íìï]/g,"i").replace(/[óòö]/g,"o").replace(/[úùü]/g,"u").replace(/ñ/g,"n").replace(/[^a-z0-9]/g,""); }
function teamMatches(apiName,ourName){ return[ourName,...(TEAM_ALIASES[ourName]||[])].some(a=>norm(a)===norm(apiName)); }
function findMatchKey(h,a){ return MATCHES.find(m=>teamMatches(h,m.home)&&teamMatches(a,m.away))?.key||null; }

// ============================================================
// STATIC DATA
// ============================================================
const INITIAL_SQUADS = {
  nandios: {
    formation:"4-3-3", captain:"Raúl Jiménez",
    squad:[
      {name:"Raúl Rangel",pos:"POR",country:"México"},
      {name:"Mark McKenzie",pos:"DEF",country:"Estados Unidos"},
      {name:"Nicolás Otamendi",pos:"DEF",country:"Argentina"},
      {name:"João Cancelo",pos:"DEF",country:"Portugal"},
      {name:"Lee Kang-in",pos:"MED",country:"Corea del Sur"},
      {name:"Ayyoub Bouaddi",pos:"MED",country:"Marruecos"},
      {name:"Casemiro",pos:"MED",country:"Brasil"},
      {name:"Nicolás Paz",pos:"MED",country:"Argentina"},
      {name:"Sadio Mané",pos:"DEL",country:"Senegal"},
      {name:"Kylian Mbappé",pos:"DEL",country:"Francia"},
      {name:"Raúl Jiménez",pos:"DEL",country:"México"},
    ]
  },
  pollo: {
    formation:"4-4-2", captain:"Mohamed Salah",
    squad:[
      {name:"Zion Suzuki",pos:"POR",country:"Japón"},
      {name:"Alejandro Grimaldo",pos:"DEF",country:"España"},
      {name:"Nathan Aké",pos:"DEF",country:"Países Bajos"},
      {name:"Ezri Konsa",pos:"DEF",country:"Inglaterra"},
      {name:"Daichi Kamada",pos:"MED",country:"Japón"},
      {name:"Sofyan Amrabat",pos:"MED",country:"Marruecos"},
      {name:"Hans Vanaken",pos:"MED",country:"Bélgica"},
      {name:"Eberechi Eze",pos:"MED",country:"Inglaterra"},
      {name:"Mohamed Salah",pos:"DEL",country:"Egipto"},
      {name:"Romelu Lukaku",pos:"DEL",country:"Bélgica"},
      {name:"Santiago Giménez",pos:"DEL",country:"México"},
    ]
  },
  luis: {
    formation:"4-3-3", captain:"Michael Olise",
    squad:[
      {name:"David Raya",pos:"POR",country:"España"},
      {name:"Facundo Medina",pos:"DEF",country:"Argentina"},
      {name:"Nico Schlotterbeck",pos:"DEF",country:"Alemania"},
      {name:"John Stones",pos:"DEF",country:"Inglaterra"},
      {name:"Maxim De Cuyper",pos:"DEF",country:"Bélgica"},
      {name:"Pedro Porro",pos:"DEF",country:"España"},
      {name:"Jamal Musiala",pos:"MED",country:"Alemania"},
      {name:"Rodrigo De Paul",pos:"MED",country:"Argentina"},
      {name:"Luka Modrić",pos:"MED",country:"Croacia"},
      {name:"Harry Kane",pos:"DEL",country:"Inglaterra"},
      {name:"Michael Olise",pos:"DEL",country:"Francia"},
    ]
  },
  didi: {
    formation:"4-3-3", captain:"Cristiano Ronaldo",
    squad:[
      {name:"Diogo Costa",pos:"POR",country:"Portugal"},
      {name:"Nicolás Tagliafico",pos:"DEF",country:"Argentina"},
      {name:"Antonio Rüdiger",pos:"DEF",country:"Alemania"},
      {name:"Denzel Dumfries",pos:"DEF",country:"Países Bajos"},
      {name:"Marquinhos",pos:"DEF",country:"Brasil"},
      {name:"N'Golo Kanté",pos:"MED",country:"Francia"},
      {name:"Pedri",pos:"MED",country:"España"},
      {name:"Enzo Fernández",pos:"MED",country:"Argentina"},
      {name:"Ousmane Dembélé",pos:"DEL",country:"Francia"},
      {name:"Mikel Oyarzabal",pos:"DEL",country:"España"},
      {name:"Cristiano Ronaldo",pos:"DEL",country:"Portugal"},
    ]
  },
  osvi: {
    formation:"4-4-2", captain:"Manuel Akanji",
    squad:[
      {name:"Unai Simón",pos:"POR",country:"España"},
      {name:"Virgil van Dijk",pos:"DEF",country:"Países Bajos"},
      {name:"Manuel Akanji",pos:"DEF",country:"Suiza"},
      {name:"Marcos Llorente",pos:"DEF",country:"España"},
      {name:"Christian Pulisic",pos:"MED",country:"Estados Unidos"},
      {name:"Takefusa Kubo",pos:"MED",country:"Japón"},
      {name:"Lucas Paquetá",pos:"MED",country:"Brasil"},
      {name:"James Rodríguez",pos:"MED",country:"Colombia"},
      {name:"Armando González",pos:"DEL",country:"México"},
      {name:"Jérémy Doku",pos:"DEL",country:"Bélgica"},
      {name:"Deniz Undav",pos:"DEL",country:"Alemania"},
    ]
  },
  javi: {
    formation:"4-3-3", captain:"Thibaut Courtois",
    squad:[
      {name:"Thibaut Courtois",pos:"POR",country:"Bélgica"},
      {name:"William Saliba",pos:"DEF",country:"Francia"},
      {name:"Rúben Dias",pos:"DEF",country:"Portugal"},
      {name:"Achraf Hakimi",pos:"DEF",country:"Marruecos"},
      {name:"Theo Hernández",pos:"DEF",country:"Francia"},
      {name:"Kevin De Bruyne",pos:"MED",country:"Bélgica"},
      {name:"Rodri",pos:"MED",country:"España"},
      {name:"Álvaro Fidalgo",pos:"MED",country:"México"},
      {name:"Julian Álvarez",pos:"DEL",country:"Argentina"},
      {name:"Marcus Rashford",pos:"DEL",country:"Inglaterra"},
      {name:"Lionel Messi",pos:"DEL",country:"Argentina"},
    ]
  },
};

const PARTICIPANTS_META = [
  {id:"nandios",name:"Nandios",emoji:"🦅"},
  {id:"pollo",  name:"Pollo",  emoji:"🐔"},
  {id:"luis",   name:"Luis",   emoji:"⚽"},
  {id:"didi",   name:"Didi",   emoji:"🎯"},
  {id:"osvi",   name:"Osvi",   emoji:"🦁"},
  {id:"javi",   name:"Javier", emoji:"🔥"},
];

const INITIAL_QUINIELAS = {
  nandios:{
    "A_MEX_RSA":[3,1],"A_KOR_CZE":[2,1],"A_CZE_MEX":[1,3],"A_RSA_KOR":[0,2],
    "B_CAN_BIH":[2,0],"B_QAT_SUI":[1,2],
    "C_BRA_MAR":[2,1],"C_HAI_SCO":[0,1],"C_SCO_MAR":[1,2],"C_MAR_HAI":[3,1],
    "D_USA_PAR":[3,1],"D_USA_AUS":[3,0],
    "E_GER_CUR":[2,0],"E_CIV_ECU":[1,1],
    "F_NED_JPN":[3,2],"F_SWE_TUN":[2,0],
    "G_BEL_EGY":[3,1],"G_IRN_NZL":[0,1],
    "H_ESP_CPV":[4,0],"H_KSA_URU":[0,2],
    "I_FRA_SEN":[3,1],"I_IRQ_NOR":[0,2],
    "J_ARG_ALG":[4,1],"J_AUT_JOR":[1,1],
    "K_POR_COD":[3,0],"K_UZB_COL":[1,2],
    "L_ENG_CRO":[2,2],"L_GHA_PAN":[2,1],
  },
  pollo:{
    "A_MEX_RSA":[2,0],"A_KOR_CZE":[1,0],
    "B_CAN_BIH":[3,1],"B_QAT_SUI":[2,2],
    "C_BRA_MAR":[4,2],"C_HAI_SCO":[2,1],
    "D_USA_PAR":[3,1],"D_AUS_TUR":[0,0],
    "E_GER_CUR":[4,1],"E_CIV_ECU":[1,2],
    "F_NED_JPN":[2,2],"F_SWE_TUN":[1,1],
    "G_BEL_EGY":[3,1],"G_IRN_NZL":[0,0],
    "H_ESP_CPV":[5,2],"H_KSA_URU":[1,3],
    "I_FRA_SEN":[3,0],"I_IRQ_NOR":[1,1],
    "J_ARG_ALG":[3,0],"J_AUT_JOR":[2,0],
    "K_POR_COD":[2,0],"K_UZB_COL":[0,1],
    "L_ENG_CRO":[2,2],"L_GHA_PAN":[0,0],
  },
  luis:{
    "A_MEX_RSA":[2,0],"A_KOR_CZE":[2,1],"A_CZE_RSA":[1,0],"A_MEX_KOR":[1,1],"A_CZE_MEX":[1,2],"A_RSA_KOR":[0,1],
    "B_CAN_BIH":[2,1],"B_QAT_SUI":[0,3],"B_SUI_BIH":[3,0],"B_CAN_QAT":[2,0],"B_BIH_QAT":[2,1],"B_SUI_CAN":[2,1],
    "C_BRA_MAR":[2,2],"C_HAI_SCO":[0,3],"C_SCO_MAR":[1,2],"C_BRA_HAI":[5,0],"C_MAR_HAI":[3,0],"C_SCO_BRA":[1,2],
    "D_USA_PAR":[1,1],"D_AUS_TUR":[1,2],"D_USA_AUS":[1,0],"D_TUR_PAR":[1,0],"D_TUR_USA":[1,1],"D_PAR_AUS":[1,0],
    "E_GER_CUR":[4,0],"E_CIV_ECU":[2,2],"E_GER_CIV":[2,0],"E_ECU_CUR":[2,0],"E_ECU_GER":[1,2],"E_CUR_CIV":[0,1],
    "F_NED_JPN":[2,1],"F_SWE_TUN":[1,0],"F_NED_SWE":[2,1],"F_TUN_JPN":[0,2],"F_JPN_SWE":[1,0],"F_TUN_NED":[0,3],
    "G_BEL_EGY":[2,0],"G_IRN_NZL":[1,0],"G_BEL_IRN":[2,0],"G_NZL_EGY":[1,0],"G_NZL_BEL":[0,3],"G_EGY_IRN":[0,1],
    "H_ESP_CPV":[5,0],"H_KSA_URU":[1,3],"H_ESP_KSA":[3,0],"H_URU_CPV":[3,0],"H_URU_ESP":[2,3],"H_CPV_KSA":[0,1],
    "I_FRA_SEN":[2,1],"I_IRQ_NOR":[0,2],"I_FRA_IRQ":[3,0],"I_NOR_SEN":[2,1],"I_SEN_IRQ":[1,0],"I_NOR_FRA":[1,2],
    "J_ARG_ALG":[2,1],"J_AUT_JOR":[2,0],
    "K_POR_COD":[2,0],"K_UZB_COL":[1,1],
    "L_ENG_CRO":[2,1],"L_GHA_PAN":[1,0],
  },
  didi:{
    "A_MEX_RSA":[3,1],"A_KOR_CZE":[2,1],
    "B_CAN_BIH":[4,1],"B_QAT_SUI":[1,3],
    "C_BRA_MAR":[3,2],"C_HAI_SCO":[2,2],
    "D_USA_PAR":[3,1],"D_AUS_TUR":[2,2],
    "E_GER_CUR":[5,0],"E_CIV_ECU":[1,2],
    "F_NED_JPN":[2,2],"F_SWE_TUN":[2,1],
    "G_BEL_EGY":[3,1],"G_IRN_NZL":[2,2],
    "H_ESP_CPV":[6,0],"H_KSA_URU":[2,3],
    "I_FRA_SEN":[3,1],"I_IRQ_NOR":[1,4],
    "J_ARG_ALG":[4,1],"J_AUT_JOR":[3,0],
    "K_POR_COD":[5,0],"K_UZB_COL":[1,4],
    "L_ENG_CRO":[3,1],"L_GHA_PAN":[2,2],
  },
  osvi:{
    "A_MEX_RSA":[2,0],"A_KOR_CZE":[1,1],
    "B_CAN_BIH":[2,1],"B_QAT_SUI":[0,2],
    "C_BRA_MAR":[2,1],"C_HAI_SCO":[0,1],
    "D_USA_PAR":[1,0],"D_AUS_TUR":[2,1],
    "E_GER_CUR":[4,0],"E_CIV_ECU":[1,1],
    "F_NED_JPN":[1,1],"F_SWE_TUN":[1,0],
    "G_BEL_EGY":[2,2],"G_IRN_NZL":[1,0],
    "H_ESP_CPV":[3,0],"H_KSA_URU":[0,2],
    "I_FRA_SEN":[2,1],"I_IRQ_NOR":[0,3],
    "J_ARG_ALG":[2,1],"J_AUT_JOR":[2,0],
    "K_POR_COD":[1,0],"K_UZB_COL":[0,2],
    "L_ENG_CRO":[2,1],"L_GHA_PAN":[2,0],
  },
  javi:{
    "A_MEX_RSA":[2,1],"A_KOR_CZE":[1,1],
    "B_CAN_BIH":[1,0],"B_QAT_SUI":[0,2],
    "C_BRA_MAR":[3,1],"C_HAI_SCO":[0,2],
    "D_USA_PAR":[1,0],"D_AUS_TUR":[0,1],
    "E_GER_CUR":[3,0],"E_CIV_ECU":[0,0],
    "F_NED_JPN":[2,0],"F_SWE_TUN":[1,1],
    "G_BEL_EGY":[1,0],"G_IRN_NZL":[2,0],
    "H_ESP_CPV":[3,0],"H_KSA_URU":[1,2],
    "I_FRA_SEN":[2,0],"I_IRQ_NOR":[0,2],
    "J_ARG_ALG":[2,0],"J_AUT_JOR":[1,0],
    "K_POR_COD":[2,0],"K_UZB_COL":[1,1],
    "L_ENG_CRO":[2,1],"L_GHA_PAN":[1,0],
  },
};

const MATCHES = [
  {key:"A_MEX_RSA",group:"A",date:"2026-06-11",home:"México",away:"Sudáfrica"},
  {key:"A_KOR_CZE",group:"A",date:"2026-06-12",home:"Corea del Sur",away:"República Checa"},
  {key:"A_CZE_RSA",group:"A",date:"2026-06-18",home:"República Checa",away:"Sudáfrica"},
  {key:"A_MEX_KOR",group:"A",date:"2026-06-19",home:"México",away:"Corea del Sur"},
  {key:"A_CZE_MEX",group:"A",date:"2026-06-24",home:"República Checa",away:"México"},
  {key:"A_RSA_KOR",group:"A",date:"2026-06-24",home:"Sudáfrica",away:"Corea del Sur"},
  {key:"B_CAN_BIH",group:"B",date:"2026-06-12",home:"Canadá",away:"Bosnia y Herzegovina"},
  {key:"B_QAT_SUI",group:"B",date:"2026-06-13",home:"Catar",away:"Suiza"},
  {key:"B_SUI_BIH",group:"B",date:"2026-06-18",home:"Suiza",away:"Bosnia y Herzegovina"},
  {key:"B_CAN_QAT",group:"B",date:"2026-06-19",home:"Canadá",away:"Catar"},
  {key:"B_BIH_QAT",group:"B",date:"2026-06-24",home:"Bosnia y Herzegovina",away:"Catar"},
  {key:"B_SUI_CAN",group:"B",date:"2026-06-24",home:"Suiza",away:"Canadá"},
  {key:"C_BRA_MAR",group:"C",date:"2026-06-13",home:"Brasil",away:"Marruecos"},
  {key:"C_HAI_SCO",group:"C",date:"2026-06-14",home:"Haití",away:"Escocia"},
  {key:"C_SCO_MAR",group:"C",date:"2026-06-19",home:"Escocia",away:"Marruecos"},
  {key:"C_BRA_HAI",group:"C",date:"2026-06-20",home:"Brasil",away:"Haití"},
  {key:"C_MAR_HAI",group:"C",date:"2026-06-24",home:"Marruecos",away:"Haití"},
  {key:"C_SCO_BRA",group:"C",date:"2026-06-24",home:"Escocia",away:"Brasil"},
  {key:"D_USA_PAR",group:"D",date:"2026-06-12",home:"Estados Unidos",away:"Paraguay"},
  {key:"D_AUS_TUR",group:"D",date:"2026-06-13",home:"Australia",away:"Turquía"},
  {key:"D_USA_AUS",group:"D",date:"2026-06-19",home:"Estados Unidos",away:"Australia"},
  {key:"D_TUR_PAR",group:"D",date:"2026-06-20",home:"Turquía",away:"Paraguay"},
  {key:"D_TUR_USA",group:"D",date:"2026-06-25",home:"Turquía",away:"Estados Unidos"},
  {key:"D_PAR_AUS",group:"D",date:"2026-06-25",home:"Paraguay",away:"Australia"},
  {key:"E_GER_CUR",group:"E",date:"2026-06-14",home:"Alemania",away:"Curazao"},
  {key:"E_CIV_ECU",group:"E",date:"2026-06-15",home:"Costa de Marfil",away:"Ecuador"},
  {key:"E_GER_CIV",group:"E",date:"2026-06-20",home:"Alemania",away:"Costa de Marfil"},
  {key:"E_ECU_CUR",group:"E",date:"2026-06-21",home:"Ecuador",away:"Curazao"},
  {key:"E_ECU_GER",group:"E",date:"2026-06-25",home:"Ecuador",away:"Alemania"},
  {key:"E_CUR_CIV",group:"E",date:"2026-06-25",home:"Curazao",away:"Costa de Marfil"},
  {key:"F_NED_JPN",group:"F",date:"2026-06-14",home:"Países Bajos",away:"Japón"},
  {key:"F_SWE_TUN",group:"F",date:"2026-06-15",home:"Suecia",away:"Túnez"},
  {key:"F_NED_SWE",group:"F",date:"2026-06-20",home:"Países Bajos",away:"Suecia"},
  {key:"F_TUN_JPN",group:"F",date:"2026-06-21",home:"Túnez",away:"Japón"},
  {key:"F_JPN_SWE",group:"F",date:"2026-06-26",home:"Japón",away:"Suecia"},
  {key:"F_TUN_NED",group:"F",date:"2026-06-26",home:"Túnez",away:"Países Bajos"},
  {key:"G_BEL_EGY",group:"G",date:"2026-06-15",home:"Bélgica",away:"Egipto"},
  {key:"G_IRN_NZL",group:"G",date:"2026-06-16",home:"Irán",away:"Nueva Zelanda"},
  {key:"G_BEL_IRN",group:"G",date:"2026-06-21",home:"Bélgica",away:"Irán"},
  {key:"G_NZL_EGY",group:"G",date:"2026-06-22",home:"Nueva Zelanda",away:"Egipto"},
  {key:"G_NZL_BEL",group:"G",date:"2026-06-27",home:"Nueva Zelanda",away:"Bélgica"},
  {key:"G_EGY_IRN",group:"G",date:"2026-06-27",home:"Egipto",away:"Irán"},
  {key:"H_ESP_CPV",group:"H",date:"2026-06-15",home:"España",away:"Cabo Verde"},
  {key:"H_KSA_URU",group:"H",date:"2026-06-16",home:"Arabia Saudí",away:"Uruguay"},
  {key:"H_ESP_KSA",group:"H",date:"2026-06-21",home:"España",away:"Arabia Saudí"},
  {key:"H_URU_CPV",group:"H",date:"2026-06-22",home:"Uruguay",away:"Cabo Verde"},
  {key:"H_URU_ESP",group:"H",date:"2026-06-27",home:"Uruguay",away:"España"},
  {key:"H_CPV_KSA",group:"H",date:"2026-06-27",home:"Cabo Verde",away:"Arabia Saudí"},
  {key:"I_FRA_SEN",group:"I",date:"2026-06-16",home:"Francia",away:"Senegal"},
  {key:"I_IRQ_NOR",group:"I",date:"2026-06-17",home:"Irak",away:"Noruega"},
  {key:"I_FRA_IRQ",group:"I",date:"2026-06-22",home:"Francia",away:"Irak"},
  {key:"I_NOR_SEN",group:"I",date:"2026-06-23",home:"Noruega",away:"Senegal"},
  {key:"I_SEN_IRQ",group:"I",date:"2026-06-26",home:"Senegal",away:"Irak"},
  {key:"I_NOR_FRA",group:"I",date:"2026-06-26",home:"Noruega",away:"Francia"},
  {key:"J_ARG_ALG",group:"J",date:"2026-06-17",home:"Argentina",away:"Argelia"},
  {key:"J_AUT_JOR",group:"J",date:"2026-06-17",home:"Austria",away:"Jordania"},
  {key:"J_ARG_AUT",group:"J",date:"2026-06-22",home:"Argentina",away:"Austria"},
  {key:"J_JOR_ALG",group:"J",date:"2026-06-23",home:"Jordania",away:"Argelia"},
  {key:"J_JOR_ARG",group:"J",date:"2026-06-27",home:"Jordania",away:"Argentina"},
  {key:"J_ALG_AUT",group:"J",date:"2026-06-27",home:"Argelia",away:"Austria"},
  {key:"K_POR_COD",group:"K",date:"2026-06-17",home:"Portugal",away:"RD Congo"},
  {key:"K_UZB_COL",group:"K",date:"2026-06-18",home:"Uzbekistán",away:"Colombia"},
  {key:"K_POR_UZB",group:"K",date:"2026-06-23",home:"Portugal",away:"Uzbekistán"},
  {key:"K_COL_COD",group:"K",date:"2026-06-24",home:"Colombia",away:"RD Congo"},
  {key:"K_COL_POR",group:"K",date:"2026-06-27",home:"Colombia",away:"Portugal"},
  {key:"K_COD_UZB",group:"K",date:"2026-06-27",home:"RD Congo",away:"Uzbekistán"},
  {key:"L_ENG_CRO",group:"L",date:"2026-06-17",home:"Inglaterra",away:"Croacia"},
  {key:"L_GHA_PAN",group:"L",date:"2026-06-17",home:"Ghana",away:"Panamá"},
  {key:"L_ENG_GHA",group:"L",date:"2026-06-23",home:"Inglaterra",away:"Ghana"},
  {key:"L_PAN_CRO",group:"L",date:"2026-06-23",home:"Panamá",away:"Croacia"},
  {key:"L_PAN_ENG",group:"L",date:"2026-06-27",home:"Panamá",away:"Inglaterra"},
  {key:"L_CRO_GHA",group:"L",date:"2026-06-27",home:"Croacia",away:"Ghana"},
];

const KNOWN_RESULTS = {
  "A_MEX_RSA":[3,1],"A_KOR_CZE":[2,1],
  "B_CAN_BIH":[2,0],"B_QAT_SUI":[1,2],
  "C_BRA_MAR":[2,1],"C_HAI_SCO":[0,1],
  "D_USA_PAR":[3,1],"D_AUS_TUR":[1,1],
  "E_GER_CUR":[2,0],"E_CIV_ECU":[1,1],
  "F_NED_JPN":[3,2],"F_SWE_TUN":[2,0],
  "G_BEL_EGY":[3,1],"G_IRN_NZL":[0,1],
  "H_ESP_CPV":[4,0],"H_KSA_URU":[0,2],
  "I_FRA_SEN":[3,1],"I_IRQ_NOR":[0,2],
  "J_ARG_ALG":[4,1],"J_AUT_JOR":[1,1],
  "K_POR_COD":[3,0],"K_UZB_COL":[1,2],
  "L_ENG_CRO":[2,2],"L_GHA_PAN":[2,1],
};

const posColor = {POR:"#f59e0b",DEF:"#3b82f6",MED:"#10b981",DEL:"#ef4444"};
const GROUPS = Array.from(new Set(MATCHES.map(m=>m.group)));

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [page, setPage] = useState("leaderboard"); // leaderboard | detail | quiniela | mis-picks | mi-equipo
  const [selectedId, setSelectedId] = useState(null);
  const [activeUser, setActiveUser] = useState(null); // who is logged in
  const [results, setResults] = useState(KNOWN_RESULTS);
  const [playerStats, setPlayerStats] = useState({});
  const [quinielas, setQuinielas] = useState(INITIAL_QUINIELAS);
  const [squads, setSquads] = useState(INITIAL_SQUADS);
  const [apiStatus, setApiStatus] = useState("fallback");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);

  // ---- Firebase listeners ----
  useEffect(() => {
    // Listen to quinielas
    const unsubQ = onSnapshot(collection(db,"quinielas"), snap => {
      const data = {};
      snap.forEach(d => { data[d.id] = d.data(); });
      if(Object.keys(data).length > 0) setQuinielas(prev => ({...prev, ...data}));
    });
    // Listen to squads (captain + transfers)
    const unsubS = onSnapshot(collection(db,"squads"), snap => {
      const data = {};
      snap.forEach(d => { data[d.id] = d.data(); });
      if(Object.keys(data).length > 0) setSquads(prev => ({...prev, ...data}));
    });
    return () => { unsubQ(); unsubS(); };
  }, []);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    await fetchResults();
    setLastUpdated(new Date());
    setLoading(false);
  }

  async function fetchResults() {
    try {
      const dates = getTournamentDatesSoFar();
      const mapped = {...KNOWN_RESULTS};
      const stats = {};
      const finishedEventIds = []; // {eventId, matchKey}

      for(const dateStr of dates) {
        try {
          const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${dateStr}`);
          if(!res.ok) continue;
          const data = await res.json();

          for(const ev of (data.events||[])) {
            const comp = ev.competitions?.[0];
            if(!comp) continue;
            const statusOk = comp.status?.type?.completed;
            const home = comp.competitors?.find(c=>c.homeAway==="home");
            const away = comp.competitors?.find(c=>c.homeAway==="away");
            if(!home||!away) continue;

            const key = findMatchKey(home.team?.displayName, away.team?.displayName);
            if(!key) continue;

            if(statusOk) {
              const h = parseInt(home.score); const a = parseInt(away.score);
              if(!isNaN(h)&&!isNaN(a)) mapped[key] = [h,a];
              finishedEventIds.push({eventId: ev.id, matchKey: key});
            }
          }
        } catch {}
      }

      // Second pass: pull the per-match summary (rosters[].roster[].stats[])
      // for accurate per-player goals, assists, cards, own goals, saves.
      for(const {eventId, matchKey} of finishedEventIds) {
        try {
          const sumRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${eventId}`);
          if(!sumRes.ok) continue;
          const sumData = await sumRes.json();
          const rosters = sumData.rosters || [];

          for(const rosterBlock of rosters) {
            for(const player of (rosterBlock.roster || [])) {
              const name = player.athlete?.displayName;
              if(!name) continue;
              const statMap = {};
              for(const s of (player.stats || [])) statMap[s.name] = s.value;

              const goals = statMap.totalGoals || 0;
              const assists = statMap.goalAssists || 0;
              const yellow = statMap.yellowCards || 0;
              const red = statMap.redCards || 0;
              const ownGoals = statMap.ownGoals || 0;
              const saves = statMap.saves || 0;
              const conceded = statMap.goalsConceded;

              // Skip players with no relevant contribution to keep payload small
              if(!goals && !assists && !yellow && !red && !ownGoals) continue;

              const playerKey = `${norm(name)}_${matchKey}`;
              stats[playerKey] = {
                name, matchKey,
                goals, assists, yellowCards: yellow, redCards: red,
                penaltySaved: 0, penaltyMissed: 0, ownGoals,
                minutesPlayed: player.subbedOut || player.subbedIn ? 60 : 90,
                saves, conceded,
              };
            }
          }
        } catch {}
      }

      setResults(mapped);
      setPlayerStats(stats);
      setApiStatus("live");
    } catch { setApiStatus("fallback"); }
  }

  function getTournamentDatesSoFar() {
    const start = new Date("2026-06-11T00:00:00");
    const today = new Date();
    const dates = [];
    let d = new Date(start);
    while(d <= today) {
      dates.push(`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`);
      d.setDate(d.getDate()+1);
    }
    return dates;
  }

  // ---- Save quiniela to Firebase ----
  async function saveQuiniela(userId, newPicks) {
    await setDoc(doc(db,"quinielas",userId), newPicks);
    setQuinielas(prev => ({...prev, [userId]: newPicks}));
  }

  // ---- Save squad (captain/transfers) to Firebase ----
  async function saveSquad(userId, newSquad) {
    await setDoc(doc(db,"squads",userId), newSquad);
    setSquads(prev => ({...prev, [userId]: newSquad}));
  }

  // ---- Compute scores ----
  function computeScores(pid) {
    const q = quinielas[pid] || {};
    const s = squads[pid] || INITIAL_SQUADS[pid];
    const squad = s.squad || [];
    const captain = s.captain;
    let quinielaTotal=0, fantasyTotal=0;
    const quinielaDetail=[], fantasyDetail=[];

    for(const match of MATCHES) {
      const actual = results[match.key];
      const predicted = q[match.key];
      if(!actual) continue;
      const [ah,aa] = actual;
      const actualResult = getResult(ah,aa);

      // Quiniela
      if(predicted) {
        const [ph,pa] = predicted;
        const hv=TEAM_VALUES[match.home]||50, av=TEAM_VALUES[match.away]||50;
        const pts = getQuinielaPoints(hv,av,actualResult,getResult(ph,pa),ah,aa,ph,pa);
        quinielaDetail.push({match,pts,predicted:[ph,pa],actual:[ah,aa],exact:ah===ph&&aa===pa});
        quinielaTotal+=pts;
      }

      // Fantasy
      for(const player of squad) {
        const isHome = player.country===match.home;
        const isAway = player.country===match.away;
        if(!isHome&&!isAway) continue;
        const statKey = Object.keys(playerStats).find(k=>{
          const [pn,mk]=k.split("_");
          if(mk!==match.key)return false;
          const last=norm(player.name.split(" ").slice(-1)[0]);
          return pn.includes(last)||last.includes(pn.slice(0,5));
        });
        const ps = statKey?playerStats[statKey]:null;
        const conceded = isHome?aa:ah;
        const cleanSheet = conceded===0&&(ps?.minutesPlayed??90)>=60;
        let pts=0;
        if(ps) pts=posPoints(player.pos,ps.goals,ps.assists,cleanSheet,ps.yellowCards,ps.redCards,ps.penaltySaved,ps.penaltyMissed,ps.ownGoals);
        else if(cleanSheet&&(player.pos==="POR"||player.pos==="DEF")) pts=FP.cleanSheet;
        const isCaptain = captain===player.name;
        if(isCaptain&&pts!==0) pts*=2;
        if(pts!==0||ps) {
          fantasyDetail.push({player,match,pts,actual:[ah,aa],isCaptain});
          fantasyTotal+=pts;
        }
      }
    }
    return {quinielaTotal,fantasyTotal,total:quinielaTotal+fantasyTotal,quinielaDetail,fantasyDetail};
  }

  const scores = PARTICIPANTS_META.map(p => {
    const sq = squads[p.id]||INITIAL_SQUADS[p.id];
    return {...p, formation:sq.formation, captain:sq.captain, squad:sq.squad, ...computeScores(p.id)};
  }).sort((a,b)=>b.total-a.total);

  const detail = scores.find(p=>p.id===selectedId);
  const statusColor = {live:"#22c55e",fallback:"#f59e0b",loading:"#60a5fa"};
  const statusLabel = {live:"🟢 En vivo",fallback:"🟡 Resultados del PDF",loading:"⌛ Cargando..."};

  function navTo(p) { setPage(p); setSelectedId(null); }

  return (
    <div style={{minHeight:"100vh",background:"#080d18",color:"#dde4f0",fontFamily:"'Inter','Helvetica Neue',sans-serif",fontSize:14}}>

      {/* HEADER */}
      <div style={{background:"linear-gradient(135deg,#0b1629,#162848,#0b1629)",borderBottom:"1px solid #1a3358",padding:"0 14px",position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:860,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:20}}>🏆</span>
            <div>
              <div style={{fontWeight:900,fontSize:13,letterSpacing:1,color:"#ffd700"}}>MUNDIAL 2026</div>
              <div style={{fontSize:9,color:"#4a7aaa",letterSpacing:1}}>FANTASY & QUINIELA</div>
            </div>
          </div>

          {/* USER SELECTOR */}
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <select value={activeUser||""} onChange={e=>setActiveUser(e.target.value||null)}
              style={{background:"#0d1e38",border:"1px solid #1a3358",borderRadius:8,color:activeUser?"#ffd700":"#4a7aaa",padding:"4px 8px",fontSize:12,cursor:"pointer"}}>
              <option value="">👤 Seleccionar usuario</option>
              {PARTICIPANTS_META.map(p=><option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
            </select>
          </div>
        </div>

        {/* NAV */}
        <div style={{maxWidth:860,margin:"0 auto",display:"flex",gap:2,paddingBottom:8,overflowX:"auto"}}>
          {[
            ["leaderboard","🏅 Tabla"],
            ["quiniela","📋 Quiniela"],
            ...(activeUser?[["mis-picks","✏️ Mis picks"],["mi-equipo","👕 Mi equipo"]]:[] )
          ].map(([id,label])=>(
            <button key={id} onClick={()=>navTo(id)} style={{
              padding:"4px 12px",borderRadius:16,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,whiteSpace:"nowrap",
              background:page===id&&!selectedId?"#ffd700":"transparent",
              color:page===id&&!selectedId?"#080d18":"#5a8ab0",transition:"all .15s"
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* STATUS */}
      <div style={{background:"#0a1220",borderBottom:"1px solid #101e34",padding:"4px 14px"}}>
        <div style={{maxWidth:860,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:10,color:statusColor[apiStatus]}}>{statusLabel[apiStatus]}</span>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {lastUpdated&&<span style={{fontSize:10,color:"#2a4a6a"}}>{lastUpdated.toLocaleTimeString("es-MX")}</span>}
            <button onClick={loadData} disabled={loading} style={{background:"none",border:"1px solid #1a3358",borderRadius:8,padding:"2px 8px",color:"#4a7aaa",fontSize:10,cursor:"pointer"}}>{loading?"...":"↻"}</button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:860,margin:"0 auto",padding:"16px 12px"}}>

        {/* ===== LEADERBOARD ===== */}
        {page==="leaderboard"&&!selectedId&&(
          <Leaderboard scores={scores} onDetail={(id)=>{setSelectedId(id);setPage("detail");}} />
        )}

        {/* ===== DETAIL ===== */}
        {page==="detail"&&selectedId&&detail&&(
          <Detail detail={detail} playerStats={playerStats} onBack={()=>{setSelectedId(null);setPage("leaderboard");}} />
        )}

        {/* ===== QUINIELA VIEW ===== */}
        {page==="quiniela"&&!selectedId&&(
          <QuinielaView results={results} quinielas={quinielas} />
        )}

        {/* ===== MIS PICKS ===== */}
        {page==="mis-picks"&&activeUser&&(
          <MisPicks
            userId={activeUser}
            userName={PARTICIPANTS_META.find(p=>p.id===activeUser)?.name}
            quiniela={quinielas[activeUser]||{}}
            results={results}
            onSave={saveQuiniela}
          />
        )}

        {/* ===== MI EQUIPO ===== */}
        {page==="mi-equipo"&&activeUser&&(
          <MiEquipo
            userId={activeUser}
            userName={PARTICIPANTS_META.find(p=>p.id===activeUser)?.name}
            squad={squads[activeUser]||INITIAL_SQUADS[activeUser]}
            onSave={saveSquad}
          />
        )}

      </div>
    </div>
  );
}

// ============================================================
// LEADERBOARD COMPONENT
// ============================================================
function Leaderboard({scores, onDetail}) {
  return (
    <div>
      <div style={{marginBottom:16}}>
        <h1 style={{margin:0,fontSize:20,fontWeight:900,color:"#ffd700"}}>Tabla General</h1>
        <p style={{margin:"3px 0 0",fontSize:11,color:"#3a6a9a"}}>Fantasy + Quiniela combinados</p>
      </div>

      {/* PODIUM */}
      <div style={{display:"flex",gap:8,marginBottom:20,alignItems:"flex-end",justifyContent:"center"}}>
        {[1,0,2].map((idx,i)=>{
          const p=scores[idx]; if(!p)return null;
          const h=[108,128,86][i];
          const medals=["🥈","🥇","🥉"];
          const golds=["linear-gradient(180deg,#c0c0c0,#6a6a6a)","linear-gradient(180deg,#ffd700,#b8860b)","linear-gradient(180deg,#cd7f32,#7a4010)"];
          return(
            <div key={p.id} onClick={()=>onDetail(p.id)} style={{flex:1,maxWidth:160,cursor:"pointer",textAlign:"center"}}>
              <div style={{fontSize:24,marginBottom:2}}>{p.emoji}</div>
              <div style={{fontSize:10,fontWeight:700,color:"#8aaac8",marginBottom:3}}>{p.name}</div>
              <div style={{height:h,borderRadius:"8px 8px 0 0",background:golds[i],display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
                <div style={{fontSize:18}}>{medals[i]}</div>
                <div style={{fontSize:24,fontWeight:900,color:idx===0?"#080d18":"#fff"}}>{p.total}</div>
                <div style={{fontSize:9,color:idx===0?"rgba(0,0,0,0.5)":"rgba(255,255,255,0.6)"}}>pts</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* TABLE */}
      <div style={{background:"#0a1220",borderRadius:12,overflow:"hidden",border:"1px solid #162840"}}>
        <div style={{display:"grid",gridTemplateColumns:"32px 1fr 64px 68px 68px 36px",padding:"7px 12px",borderBottom:"1px solid #162840",fontSize:9,color:"#2a4a6a",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>
          <span>#</span><span>Jugador</span><span style={{textAlign:"center"}}>Fantasy</span><span style={{textAlign:"center"}}>Quiniela</span><span style={{textAlign:"center"}}>Total</span><span/>
        </div>
        {scores.map((p,i)=>(
          <div key={p.id} onClick={()=>onDetail(p.id)}
            style={{display:"grid",gridTemplateColumns:"32px 1fr 64px 68px 68px 36px",padding:"11px 12px",borderBottom:i<scores.length-1?"1px solid #0e1c30":"none",cursor:"pointer",alignItems:"center"}}
            onMouseEnter={e=>e.currentTarget.style.background="#0d1e38"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}
          >
            <span style={{fontWeight:900,color:["#ffd700","#c0c0c0","#cd7f32"][i]||"#2a4a6a",fontSize:14}}>{i+1}</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:18}}>{p.emoji}</span>
              <div>
                <div style={{fontWeight:700,fontSize:13}}>{p.name}</div>
                <div style={{fontSize:10,color:"#2a4a6a"}}>{p.formation} · Cap: {p.captain||"—"}</div>
              </div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:15,fontWeight:800,color:"#60a5fa"}}>{p.fantasyTotal}</div>
              <div style={{fontSize:8,color:"#2a4a6a"}}>fantasy</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:15,fontWeight:800,color:"#a78bfa"}}>{p.quinielaTotal}</div>
              <div style={{fontSize:8,color:"#2a4a6a"}}>quiniela</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:18,fontWeight:900,color:"#ffd700"}}>{p.total}</div>
            </div>
            <div style={{textAlign:"right",color:"#2a4a6a",fontSize:16}}>›</div>
          </div>
        ))}
      </div>

      {/* LEGEND */}
      <div style={{marginTop:14,background:"#0a1220",borderRadius:10,padding:12,border:"1px solid #162840"}}>
        <div style={{fontSize:9,fontWeight:700,color:"#2a4a6a",letterSpacing:1,marginBottom:8,textTransform:"uppercase"}}>Tabulador</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 14px",fontSize:10}}>
          {[["⚽ Gol portero","+12"],["⚽ Gol defensa","+7"],["⚽ Gol mediocampista","+5"],["⚽ Gol delantero","+4"],
            ["🎯 Asistencia","+3"],["🧤 Portería en cero","+4"],["🛑 Penal atajado","+5"],
            ["🟡 Amarilla","-1"],["❌ Penal fallado","-2"],["🔴 Autogol","-3"],["🟥 Roja","-4"]
          ].map(([l,v])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",color:"#4a6a8a"}}>
              <span>{l}</span><span style={{color:v.startsWith("+")?"#22c55e":"#ef4444",fontWeight:700}}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #162840",fontSize:10,color:"#2a4a6a"}}>
          <b style={{color:"#4a6a8a"}}>Quiniela:</b>
          <span style={{marginLeft:6}}>Favorito <b style={{color:"#ffd700"}}>1pt</b></span>
          <span style={{marginLeft:6}}>Empate <b style={{color:"#ffd700"}}>3pts</b></span>
          <span style={{marginLeft:6}}>Underdog <b style={{color:"#ffd700"}}>5pts</b></span>
          <span style={{marginLeft:6}}>Exacto <b style={{color:"#ffd700"}}>+3pts</b></span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DETAIL COMPONENT
// ============================================================
function Detail({detail, playerStats, onBack}) {
  return (
    <div>
      <button onClick={onBack} style={{background:"none",border:"none",color:"#5a8ab0",cursor:"pointer",fontSize:12,marginBottom:14,padding:0}}>← Volver</button>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
        <span style={{fontSize:40}}>{detail.emoji}</span>
        <div>
          <h2 style={{margin:0,fontSize:22,fontWeight:900}}>{detail.name}</h2>
          <div style={{fontSize:11,color:"#3a6a9a"}}>{detail.formation} · Cap: {detail.captain||"—"}</div>
        </div>
        <div style={{marginLeft:"auto",textAlign:"right"}}>
          <div style={{fontSize:32,fontWeight:900,color:"#ffd700"}}>{detail.total}</div>
          <div style={{fontSize:10,color:"#3a6a9a"}}>pts totales</div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        {[{l:"Fantasy",v:detail.fantasyTotal,c:"#60a5fa",i:"⚽"},{l:"Quiniela",v:detail.quinielaTotal,c:"#a78bfa",i:"📋"}].map(s=>(
          <div key={s.l} style={{background:"#0a1220",borderRadius:10,padding:12,border:"1px solid #162840",textAlign:"center"}}>
            <div style={{fontSize:20}}>{s.i}</div>
            <div style={{fontSize:28,fontWeight:900,color:s.c}}>{s.v}</div>
            <div style={{fontSize:11,color:"#3a6a9a"}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Squad */}
      <div style={{background:"#0a1220",borderRadius:10,padding:12,border:"1px solid #162840",marginBottom:12}}>
        <div style={{fontWeight:700,fontSize:11,color:"#5a8ab0",marginBottom:8,letterSpacing:1}}>🏟️ ALINEACIÓN</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
          {detail.squad.map(pl=>(
            <div key={pl.name} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:7,background:"#080d18"}}>
              <span style={{fontSize:9,fontWeight:700,padding:"2px 5px",borderRadius:4,background:posColor[pl.pos],color:"#fff",minWidth:26,textAlign:"center"}}>{pl.pos}</span>
              <div>
                <div style={{fontSize:11,fontWeight:600}}>{pl.name}{detail.captain===pl.name?" ©":""}</div>
                <div style={{fontSize:9,color:"#2a4a6a"}}>{pl.country}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quiniela detail */}
      <div style={{background:"#0a1220",borderRadius:10,padding:12,border:"1px solid #162840",marginBottom:12}}>
        <div style={{fontWeight:700,fontSize:11,color:"#a78bfa",marginBottom:8,letterSpacing:1}}>📋 QUINIELA</div>
        {detail.quinielaDetail.filter(d=>d.pts>0).length===0
          ?<div style={{fontSize:12,color:"#2a4a6a",textAlign:"center",padding:"14px 0"}}>Sin puntos aún</div>
          :detail.quinielaDetail.filter(d=>d.pts>0).map((d,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #0e1c30"}}>
              <div>
                <div style={{fontSize:11,fontWeight:600}}>{d.match.home} vs {d.match.away}</div>
                <div style={{fontSize:10,color:"#3a6a9a"}}>Real: <b style={{color:"#ffd700"}}>{d.actual[0]}-{d.actual[1]}</b> · Pronóstico: {d.predicted[0]}-{d.predicted[1]}{d.exact?" 🎯":""}</div>
              </div>
              <div style={{fontSize:15,fontWeight:900,color:"#a78bfa"}}>+{d.pts}</div>
            </div>
          ))
        }
      </div>

      {/* Fantasy detail */}
      <div style={{background:"#0a1220",borderRadius:10,padding:12,border:"1px solid #162840"}}>
        <div style={{fontWeight:700,fontSize:11,color:"#60a5fa",marginBottom:6,letterSpacing:1}}>⚽ FANTASY</div>
        {Object.keys(playerStats).length===0&&<div style={{fontSize:10,color:"#3a6a9a",marginBottom:8}}>📡 Stats de jugadores cargando desde API...</div>}
        {detail.fantasyDetail.length===0
          ?<div style={{fontSize:12,color:"#2a4a6a",textAlign:"center",padding:"14px 0"}}>Sin datos aún</div>
          :detail.fantasyDetail.map((d,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #0e1c30"}}>
              <div>
                <div style={{fontSize:11,fontWeight:600}}>{d.player.name}{d.isCaptain?" ©":""} <span style={{fontSize:8,padding:"1px 4px",borderRadius:3,background:posColor[d.player.pos],color:"#fff"}}>{d.player.pos}</span></div>
                <div style={{fontSize:10,color:"#3a6a9a"}}>{d.match.home} {d.actual[0]}-{d.actual[1]} {d.match.away}</div>
              </div>
              <div style={{fontSize:15,fontWeight:900,color:d.pts>=0?"#60a5fa":"#ef4444"}}>{d.pts>=0?"+":""}{d.pts}</div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ============================================================
// QUINIELA VIEW COMPONENT
// ============================================================
function QuinielaView({results, quinielas}) {
  return (
    <div>
      <div style={{marginBottom:16}}>
        <h1 style={{margin:0,fontSize:20,fontWeight:900,color:"#a78bfa"}}>Quiniela</h1>
        <p style={{margin:"3px 0 0",fontSize:11,color:"#3a6a9a"}}>🎯 exacto · 🟦 ganador correcto · 🟥 fallido</p>
      </div>
      {GROUPS.map(group=>(
        <div key={group} style={{marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:900,color:"#ffd700",letterSpacing:2,marginBottom:7}}>GRUPO {group}</div>
          {MATCHES.filter(m=>m.group===group).map(match=>{
            const actual=results[match.key];
            return(
              <div key={match.key} style={{background:"#0a1220",borderRadius:9,padding:10,marginBottom:6,border:"1px solid #162840"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:700}}>{match.home} <span style={{color:"#2a4a6a"}}>vs</span> {match.away}</div>
                    <div style={{fontSize:9,color:"#2a4a6a"}}>{new Date(match.date+"T12:00:00").toLocaleDateString("es-MX",{day:"numeric",month:"short"})}</div>
                  </div>
                  {actual?<div style={{fontSize:18,fontWeight:900,color:"#ffd700"}}>{actual[0]} — {actual[1]}</div>
                         :<div style={{fontSize:10,color:"#2a4a6a",fontStyle:"italic"}}>Por jugar</div>}
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {PARTICIPANTS_META.map(p=>{
                    const pred=(quinielas[p.id]||{})[match.key];
                    if(!pred)return<span key={p.id} style={{fontSize:10,padding:"3px 7px",borderRadius:5,background:"#080d18",color:"#2a4a6a"}}>{p.emoji} —</span>;
                    const correct=actual&&getResult(actual[0],actual[1])===getResult(pred[0],pred[1]);
                    const exact=actual&&actual[0]===pred[0]&&actual[1]===pred[1];
                    return(
                      <span key={p.id} style={{
                        fontSize:10,padding:"3px 8px",borderRadius:5,fontWeight:600,
                        background:exact?"#14532d":correct?"#1a3560":actual?"#2d1010":"#0e1c30",
                        color:exact?"#4ade80":correct?"#60a5fa":actual?"#f87171":"#5a8ab0",
                        border:`1px solid ${exact?"#22c55e":correct?"#2a5a9a":actual?"#7f1d1d":"#162840"}`
                      }}>{p.emoji} {pred[0]}-{pred[1]}</span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// MIS PICKS COMPONENT
// ============================================================
function MisPicks({userId, userName, quiniela, results, onSave}) {
  const [picks, setPicks] = useState({...quiniela});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [filterGroup, setFilterGroup] = useState("ALL");

  const pendingMatches = MATCHES.filter(m => !results[m.key] && !picks[m.key]);

  async function handleSave() {
    setSaving(true);
    await onSave(userId, picks);
    setSaving(false);
    setSaved(true);
    setTimeout(()=>setSaved(false), 2000);
  }

  function setScore(key, side, val) {
    const num = parseInt(val);
    if(isNaN(num)||num<0||num>20) return;
    setPicks(prev => {
      const current = prev[key]||[0,0];
      return {...prev, [key]: side==="h"?[num,current[1]]:[current[0],num]};
    });
  }

  const groups = ["ALL",...GROUPS];
  const filteredMatches = MATCHES.filter(m => filterGroup==="ALL"||m.group===filterGroup);

  return (
    <div>
      <div style={{marginBottom:14}}>
        <h1 style={{margin:0,fontSize:20,fontWeight:900,color:"#ffd700"}}>✏️ Mis Picks</h1>
        <p style={{margin:"3px 0 0",fontSize:11,color:"#3a6a9a"}}>{userName} · {pendingMatches.length} partidos sin pronosticar</p>
      </div>

      {/* PENDING ALERT */}
      {pendingMatches.length>0&&(
        <div style={{background:"#2d1a00",border:"1px solid #f59e0b",borderRadius:9,padding:"10px 12px",marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"#f59e0b",marginBottom:6}}>⚠️ Partidos sin pronóstico ({pendingMatches.length})</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {pendingMatches.map(m=>(
              <span key={m.key} style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:"#3d2200",color:"#fbbf24"}}>
                {m.home.split(" ")[0]} vs {m.away.split(" ")[0]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* GROUP FILTER */}
      <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
        {groups.map(g=>(
          <button key={g} onClick={()=>setFilterGroup(g)} style={{
            padding:"4px 10px",borderRadius:14,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,
            background:filterGroup===g?"#ffd700":"#0a1220",color:filterGroup===g?"#080d18":"#4a7aaa"
          }}>{g==="ALL"?"Todos":"Grupo "+g}</button>
        ))}
      </div>

      {/* MATCHES */}
      {filteredMatches.map(match=>{
        const actual=results[match.key];
        const pick=picks[match.key];
        const played=!!actual;
        return(
          <div key={match.key} style={{background:"#0a1220",borderRadius:9,padding:12,marginBottom:8,border:`1px solid ${played?"#1a3358":"#162840"}`,opacity:played?0.7:1}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,marginBottom:2}}>{match.home} vs {match.away}</div>
                <div style={{fontSize:9,color:"#2a4a6a"}}>{new Date(match.date+"T12:00:00").toLocaleDateString("es-MX",{day:"numeric",month:"short"})} · Grupo {match.group}</div>
              </div>

              {played?(
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:10,color:"#3a6a9a",marginBottom:2}}>Resultado</div>
                  <div style={{fontSize:16,fontWeight:900,color:"#ffd700"}}>{actual[0]}-{actual[1]}</div>
                  {pick&&<div style={{fontSize:10,color:getResult(actual[0],actual[1])===getResult(pick[0],pick[1])?"#4ade80":"#f87171"}}>Tu pick: {pick[0]}-{pick[1]}</div>}
                </div>
              ):(
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <input type="number" min="0" max="20" value={pick?.[0]??""} placeholder="0"
                    onChange={e=>setScore(match.key,"h",e.target.value)}
                    style={{width:44,textAlign:"center",background:"#0d1e38",border:`1px solid ${pick?"#3b82f6":"#1a3358"}`,borderRadius:7,color:"#fff",padding:"6px 4px",fontSize:15,fontWeight:700}}
                  />
                  <span style={{color:"#2a4a6a",fontWeight:700}}>—</span>
                  <input type="number" min="0" max="20" value={pick?.[1]??""} placeholder="0"
                    onChange={e=>setScore(match.key,"a",e.target.value)}
                    style={{width:44,textAlign:"center",background:"#0d1e38",border:`1px solid ${pick?"#3b82f6":"#1a3358"}`,borderRadius:7,color:"#fff",padding:"6px 4px",fontSize:15,fontWeight:700}}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* SAVE BUTTON */}
      <div style={{position:"sticky",bottom:16,marginTop:16}}>
        <button onClick={handleSave} disabled={saving} style={{
          width:"100%",padding:"14px",borderRadius:10,border:"none",cursor:"pointer",fontSize:14,fontWeight:900,
          background:saved?"#14532d":"linear-gradient(135deg,#2563eb,#7c3aed)",
          color:"#fff",boxShadow:"0 4px 20px rgba(37,99,235,0.4)",transition:"all .2s"
        }}>
          {saving?"Guardando...":saved?"✅ Guardado":"💾 Guardar pronósticos"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// MI EQUIPO COMPONENT
// ============================================================
function MiEquipo({userId, userName, squad, onSave}) {
  const [captain, setCaptain] = useState(squad.captain||"");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(userId, {...squad, captain});
    setSaving(false);
    setSaved(true);
    setTimeout(()=>setSaved(false), 2000);
  }

  return (
    <div>
      <div style={{marginBottom:16}}>
        <h1 style={{margin:0,fontSize:20,fontWeight:900,color:"#ffd700"}}>👕 Mi Equipo</h1>
        <p style={{margin:"3px 0 0",fontSize:11,color:"#3a6a9a"}}>{userName} · {squad.formation}</p>
      </div>

      {/* CAPTAIN SELECTOR */}
      <div style={{background:"#0a1220",borderRadius:10,padding:14,border:"1px solid #162840",marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:12,color:"#ffd700",marginBottom:10}}>© Capitán de la jornada</div>
        <p style={{fontSize:11,color:"#3a6a9a",margin:"0 0 10px"}}>El capitán suma puntos dobles (positivos o negativos). Cámbialo antes de cada jornada.</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
          {(squad.squad||[]).map(pl=>(
            <div key={pl.name} onClick={()=>setCaptain(pl.name)}
              style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:8,cursor:"pointer",
                background:captain===pl.name?"#1a3560":"#080d18",
                border:`2px solid ${captain===pl.name?"#ffd700":"#162840"}`,
                transition:"all .15s"
              }}>
              <span style={{fontSize:9,fontWeight:700,padding:"2px 5px",borderRadius:4,background:posColor[pl.pos],color:"#fff",minWidth:26,textAlign:"center"}}>{pl.pos}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:captain===pl.name?"#ffd700":"#dde4f0"}}>{pl.name}</div>
                <div style={{fontSize:9,color:"#2a4a6a"}}>{pl.country}</div>
              </div>
              {captain===pl.name&&<span style={{fontSize:16}}>©</span>}
            </div>
          ))}
        </div>
      </div>

      {/* SQUAD VIEW */}
      <div style={{background:"#0a1220",borderRadius:10,padding:14,border:"1px solid #162840",marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:12,color:"#5a8ab0",marginBottom:4}}>🏟️ Plantilla actual</div>
        <div style={{fontSize:10,color:"#2a4a6a",marginBottom:10}}>Las transferencias se habilitarán al terminar la fase de grupos.</div>
        {(squad.squad||[]).map(pl=>(
          <div key={pl.name} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid #0e1c30"}}>
            <span style={{fontSize:9,fontWeight:700,padding:"2px 5px",borderRadius:4,background:posColor[pl.pos],color:"#fff",minWidth:26,textAlign:"center"}}>{pl.pos}</span>
            <div style={{flex:1}}>
              <span style={{fontSize:12,fontWeight:600}}>{pl.name}</span>
              {captain===pl.name&&<span style={{marginLeft:6,fontSize:10,color:"#ffd700",fontWeight:700}}>© Capitán</span>}
            </div>
            <span style={{fontSize:10,color:"#2a4a6a"}}>{pl.country}</span>
          </div>
        ))}
      </div>

      <div style={{position:"sticky",bottom:16}}>
        <button onClick={handleSave} disabled={saving||!captain} style={{
          width:"100%",padding:"14px",borderRadius:10,border:"none",cursor:"pointer",fontSize:14,fontWeight:900,
          background:saved?"#14532d":!captain?"#1a2a3a":"linear-gradient(135deg,#2563eb,#7c3aed)",
          color:"#fff",boxShadow:captain?"0 4px 20px rgba(37,99,235,0.4)":"none",transition:"all .2s"
        }}>
          {saving?"Guardando...":saved?"✅ Guardado":!captain?"Selecciona un capitán":"💾 Guardar capitán"}
        </button>
      </div>
    </div>
  );
}
