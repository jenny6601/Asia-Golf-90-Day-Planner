/**
 * Okinawa Main Island pilot course catalog.
 * Coordinates are representative course-centre points from published map data;
 * verify against official club entrance/course polygons before operational use.
 */
export const OKINAWA_COURSES = Object.freeze([
  {
    id:"southern-links",name:"The Southern Links Golf Club",nameJa:"ザ・サザンリンクスゴルフクラブ",
    area:"南部",city:"八重瀬町",address:"697 Hanashiro, Yaese, Shimajiri District, Okinawa 901-0513, Japan",
    latitude:26.118019,longitude:127.738385,coordinateSource:"FullGolf / OpenStreetMap",coordinateSourceUrl:null,
    coordinateStatus:"provisional",officialUrl:"https://reserve.accordiagolf.com/en/global/golfCourse/okinawa/southernlinks"
  },
  {
    id:"pgm-okinawa",name:"PGM Golf Resort Okinawa",nameJa:"ＰＧＭゴルフリゾート沖縄",
    area:"中部",city:"恩納村",address:"1043 Fuchaku, Onna-son, Kunigami-gun, Okinawa 904-0413, Japan",
    latitude:null,longitude:null,coordinateSource:"Official PGM course address; independent course-point verification pending",coordinateSourceUrl:"https://www.pacificgolf.co.jp/okinawa/information.asp",
    coordinateStatus:"pending",officialUrl:"https://www.pacificgolf.co.jp/okinawa/"
  },
  {
    id:"kise",name:"Kanehide Kise Country Club",nameJa:"かねひで喜瀬カントリークラブ",
    area:"北部",city:"名護市",address:"1107-1 Kise, Nago, Okinawa 905-0026, Japan",
    latitude:26.524415,longitude:127.93946,coordinateSource:"Travelmyth map listing",coordinateSourceUrl:"https://www.travelmyth.co.uk/Nago/Hotels/Kanehide-Kise-Country-Club_tmid257562",
    coordinateStatus:"provisional",officialUrl:"https://www.kise-cc.jp/en/"
  },
  {
    id:"atta-terrace",name:"The Atta Terrace Golf Resort",nameJa:"ジ・アッタテラス ゴルフリゾート",
    area:"北部",city:"恩納村",address:"1079 Afuso, Onna-son, Kunigami-gun, Okinawa 904-0402, Japan",
    latitude:26.499693,longitude:127.896228,coordinateSource:"Where2Golf map listing",coordinateSourceUrl:"https://www.where2golf.com/japan/the-atta-terrace-golf-resort/",
    coordinateStatus:"provisional",officialUrl:"https://www.terrace.co.jp/en/atta/"
  },
  {
    id:"palm-hills",name:"Palm Hills Golf Resort Club",nameJa:"パームヒルズゴルフリゾートクラブ",
    area:"南部",city:"糸滿市",address:"762 Arakaki, Itoman, Okinawa 901-0323, Japan",
    latitude:26.11934,longitude:127.701172,coordinateSource:"FullGolf / OpenStreetMap",coordinateSourceUrl:"https://www.fullgolf.com/en/golf-club/japan/okinawa/itoman/palm-hills-golf-resort",
    coordinateStatus:"provisional",officialUrl:"https://reserve.accordiagolf.com/en/global/golfCourse/okinawa/palmhills/"
  },
  {
    id:"chura-orchard",name:"Chura Orchard Golf Club",nameJa:"美らオーチャードゴルフ倶楽部",
    area:"北部",city:"恩納村",address:"1577 Afuso, Onna-son, Kunigami-gun, Okinawa 904-0402, Japan",
    latitude:26.496499,longitude:127.891015,coordinateSource:"FullGolf / OpenStreetMap",coordinateSourceUrl:"https://www.fullgolf.com/en/golf-course/japan/okinawa/kunigami/chura-orchard",
    coordinateStatus:"provisional",officialUrl:"http://www.churaorchard.co.jp/"
  }
]);
