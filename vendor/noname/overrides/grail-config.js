/* GPL-3.0: local integration configuration, 2026-10-24. */
(() => {
  const query = new URLSearchParams(location.search);
  const prefix = "star_grail_full_v1_";
  const official = [
    "shiZhouNian",
    "yiDuanYeHuo",
    "shenZiChuangLin",
    "zhongMoDaoZhu",
    "teDian",
  ];
  const legacy = query.get("edition") === "legacy";
  const packs = legacy ? [...official, "sanBan", "siBan"] : official;
  const mode = query.has("online") ? "connect" : query.get("view") === "catalog" ? "illustration" : "xingBei";
  // The upstream first-touch prompt saves a flag and reloads. This launcher
  // rebuilds its config on every visit, so omitting that flag caused an
  // endless confirm/reload loop on iOS and Android. Set both config layers
  // before the engine creates any input listeners; fine-pointer laptops keep
  // mouse input even when their display also supports touch.
  const touchscreen = typeof window.matchMedia === "function"
    ? window.matchMedia("(pointer: coarse)").matches
    : /iphone|ipad|ipod|android/i.test(window.navigator?.userAgent || "");
  // QA may load the actual phone stylesheet while keeping mouse input usable.
  const phonelayout = touchscreen || query.get("phone-layout") === "1";
  const input = { totouched: true, touchscreen, phonelayout, fold_mode: false, cardshape: "oblong" };
  // The upstream touch handler only allows horizontal swipes when its hand
  // container has scrollh. Disabling its fan on small screens preserves that
  // native scrolling path for our larger, full-width card row.
  if (window.matchMedia?.("(max-width: 600px), (min-width: 601px) and (max-width: 1049px) and (max-height: 500px)").matches) input.fold_card = false;
  document.documentElement.classList.toggle("grail-phone-layout", phonelayout);
  // A separate localStorage namespace avoids modifying existing core matches.
  window.nodb = true;
  Object.assign(window.config, input);
  window.config.video = 0;
  window.config.mode = mode;
  window.config.characters = packs;
  window.config.all.sgscharacters = packs;
  window.config.all.sgsmodes = [mode];
  window.config.all.stockmode = ["xingBei", "illustration", "connect"];
  window.config.all.nogamemode = ["illustration"];
  window.config.connect_characters = [];
  window.config.show_connect = false;
  window.config.show_handcardbutton = false;
  window.config.show_volumn = false;
  window.config.extensions = [];
  window.config.show_splash = "off";
  window.config.background_music = "music_off";
  window.config.background_audio = false;
  window.config.background_speak = false;
  window.config.image_background = "default";
  window.config.card_font = "default";
  window.config.cheat = false;
  window.config.character_dialog_tool = "all";
  window.config.auto_skill = false;
  window.config.auto_confirm = false;
  // The legacy hover menu can cover the settings button after viewport
  // scaling and turn a click into a mode restart. Keep the explicit menu.
  window.config.auto_popped_config = false;
  window.config.duration = 350;
  window.config.confirm_exit = true;
  const count = Number(query.get("players"));
  const options = {
    ...input,
    mode,
    video: 0,
    auto_popped_config: false,
    characters: packs,
    show_splash: "off",
    extensions: [],
    show_connect: false,
    show_handcardbutton: false,
    show_volumn: false,
    versus_mode_mode_config_xingBei:
      count === 8 ? "four" : count === 6 ? "three" : "two",
    team_sequence_mode_config_xingBei: "crossed",
    free_choose_mode_config_xingBei: true,
    choose_number_mode_config_xingBei: 5,
    shiQiMax_mode_config_xingBei: count === 8 ? 18 : 15,
    phaseswap_mode_config_xingBei: false,
    viewHandcard_mode_config_xingBei: false,
    xingBei_banned: [],
  };
  // Native imports load configuration asynchronously. Keep launch conditions
  // in this document: another solo/catalog/online tab shares localStorage and
  // can otherwise change the selected mode before loadConfig finishes.
  window.grailLaunchConfig = options;
  localStorage.setItem(prefix + "directstart", "true");
  // Credit and license are displayed on the launcher and linked in the game.
  localStorage.setItem("gplv3_noname_alerted", "true");
})();
