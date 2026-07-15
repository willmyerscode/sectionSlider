/**
 * Section Slider Plugin for Squarespace
 * Copyright Will-Myers.com
 **/
class WMSectionSlider {
  static emitEvent(type, detail = {}, elem = document) {
    // Make sure there's an event type
    if (!type) return;

    // Create a new event
    let event = new CustomEvent(type, {
      bubbles: true,
      cancelable: true,
      detail: detail,
    });

    // Dispatch the event
    return elem.dispatchEvent(event);
  }
  constructor(el, settings) {
    this.el = el;
    this.initEl = this.el.querySelector('[data-wm-plugin="section-slider"]');
    this.settings = settings;
    this.activeSection = null;
    this.init();
  }
  init() {
    this.setHeaderHeightVariable();
    this.initSwiper();
    this.bindEvents();
  }
  bindEvents() {
    this.addResizeEventListener();
    this.addDOMContentLoadedEventListener();
    this.addSlideChangeEventListener();
    this.addAfterInitEventListener();
    this.addFuncHeaderColorThemeMatch();
    this.addFuncSliderColorThemeMatch();
    this.addAutoplayToggle();
  }
  addResizeEventListener() {
    const handleResize = () => {
      this.setHeaderHeightVariable();
    };
    window.addEventListener("resize", handleResize);

    // Swiper pauses autoplay when crossing breakpoints (e.g. mobile rotation
    // portrait <-> landscape crosses the 767px tablet breakpoint). Resume it.
    const restartAutoplayIfStopped = () => {
      const ap = this.swiper?.autoplay;
      // params.autoplay is always a truthy object (e.g. {enabled: false, ...}),
      // so check .enabled — otherwise we'd force-start autoplay on sliders that
      // never opted in (no data-autoplay-timer) when Swiper fires "breakpoint".
      if (!this.swiper?.params?.autoplay?.enabled || !ap) return;
      if (this._autoplayUserPaused) return;
      if (ap.paused) ap.resume();
      if (!ap.running) ap.start();
    };
    this.swiper.on("breakpoint", restartAutoplayIfStopped);
    window.addEventListener("orientationchange", () => {
      // Wait for layout to settle after the rotation animation
      setTimeout(restartAutoplayIfStopped, 250);
    });
  }
  addDOMContentLoadedEventListener() {}
  addLoadEventListener() {}
  addAfterInitEventListener() {
    if (this.settings.restartBackgroundVideos) {
      this.addFuncRestartBackgroundVideos();
    } else if (this.settings.pauseInactiveBackgroundVideos) {
      this.addFuncPauseInactiveBackgroundVideos();
    }

    this.addFuncRandomizeSlides();
  }
  addSlideChangeEventListener() {
    this.swiper.on("activeIndexChange", () => {
      this.activeSection = this.swiper.slides[this.swiper.activeIndex].querySelector(".page-section");
      WMSectionSlider.emitEvent("wmSectionSlider:slideChange", {
        container: this.el,
        activeSection: this.activeSection,
      });
    });
  }
  setHeaderHeightVariable() {
    const header = document.getElementById("header"); // Adjust selector as needed
    if (header) {
      const headerHeight = header.offsetHeight;
      this.el.style.setProperty("--header-height", `${headerHeight}px`);
    }
  }
  addFuncPauseInactiveBackgroundVideos() {
    const container = this.el;
    let debounceTimer;

    const playVideo = async video => {
      try {
        await video.play();
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Error playing video:", error);
        }
      }
    };

    const updateVideos = async () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const slides = this.swiper.slides;
        const activeIndex = this.swiper.activeIndex;

        for (let i = 0; i < slides.length; i++) {
          const video = slides[i].querySelector(".sqs-video-background-native video");
          if (video) {
            if (i === activeIndex) {
              await playVideo(video);
            } else {
              video.pause();
            }
          }
        }
      }, 50);
    };

    this.swiper.on("realIndexChange", updateVideos);

    const observeVideoAddition = controller => {
      const observer = new MutationObserver(async mutationsList => {
        for (const mutation of mutationsList) {
          if (mutation.type === "childList") {
            const addedVideo = mutation.addedNodes[0];
            if (addedVideo && addedVideo.matches(".sqs-video-background-native video")) {
              updateVideos();
              observer.disconnect();
              break;
            }
          }
        }
      });

      observer.observe(controller, {childList: true, subtree: true});
    };

    const videoControllers = container.querySelectorAll('.section-border [data-controller="VideoBackgroundNative"]');
    videoControllers.forEach(observeVideoAddition);

    // Initial video state setup
    updateVideos();
  }
  addFuncRestartBackgroundVideos() {
    this.swiper.on("realIndexChange", () => {
      this.swiper.slides.forEach((slide, index) => {
        const video = slide.querySelector(".sqs-video-background-native video");
        if (video) {
          if (index === this.swiper.activeIndex) {
            video.currentTime = 0;
            video.play();
          } else {
          }
        }
      });
    });
    this.swiper.on("transitionEnd", () => {
      this.swiper.slides.forEach((slide, index) => {
        const video = slide.querySelector(".sqs-video-background-native video");
        if (video) {
          if (index === this.swiper.activeIndex) {
          } else {
            video.pause();
            video.currentTime = 0;
          }
        }
      });
    });
  }
  addFuncRandomizeSlides() {
    if (!this.initEl.dataset.randomize) return;
    const totalSlides = this.swiper.slides.length;
    const randomIndex = Math.floor(Math.random() * totalSlides);

    this.swiper.slideTo(randomIndex);
  }
  addFuncHeaderColorThemeMatch() {
    const isFirstSection = this.el.matches("#sections > *:first-child");
    const isFixedHeader = window.Static?.SQUARESPACE_CONTEXT?.tweakJSON["tweak-fixed-header"] === "true";
    const isSolidHeader = document.getElementById("header")?.dataset.headerStyle === "solid";

    if (isFirstSection && this.settings.headerColorThemeMatch && !isFixedHeader && !isSolidHeader) {
      this.swiper.on("activeIndexChange", () => {
        const colorTheme = this.activeSection.dataset.sectionTheme;
        const header = document.getElementById("header");
        if (header) {
          header.dataset.sectionTheme = colorTheme;
        }
      });
    }
  }
  addFuncSliderColorThemeMatch() {
    if (this.settings.colorThemeMatch) {
      this.swiper.on("activeIndexChange", () => {
        const colorTheme = this.activeSection.dataset.sectionTheme;
        this.swiper.el.dataset.sectionTheme = colorTheme;
      });
    }
  }
  addAutoplayToggle() {
    const toggle = this.el.querySelector('.wm-slider-autoplay-toggle button');
    if (!toggle) return;

    this._autoplayUserPaused = false;

    const updateToggleState = (playing) => {
      toggle.setAttribute('aria-label', playing ? 'Pause slideshow' : 'Play slideshow');
      toggle.dataset.playing = String(playing);
    };

    toggle.addEventListener('click', () => {
      if (this.swiper.autoplay.running) {
        this._autoplayUserPaused = true;
        this.swiper.autoplay.stop();
      } else {
        this._autoplayUserPaused = false;
        this.swiper.autoplay.start();
      }
    });

    this.swiper.on('autoplayStop', () => updateToggleState(false));
    this.swiper.on('autoplayStart', () => updateToggleState(true));
  }

  initSwiper() {
    const data = this.initEl.dataset;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const requestedEffect = parseAttributeValue(data.effect) || "slide";
    const iosFallback = data.iosFallbackEffect || this.settings.coverflow?.iosFallbackEffect;
    const useEffect = (isIOS && requestedEffect === "coverflow" && iosFallback) 
      ? iosFallback 
      : requestedEffect;
    
    this.swiper = new Swiper(this.el, {
      speed: data.transitionSpeed || 400,
      navigation: {
        nextEl: this.el.querySelector(".navigation-button-next"),
        prevEl: this.el.querySelector(".navigation-button-prev"),
      },
      loop: data.loop ? parseAttributeValue(data.loop) : true,
      rewind: parseAttributeValue(data.rewind) || false,
      autoplay: getAutoplaySettings(data, this.settings),
      autoHeight: data.fixedHeight ? !parseAttributeValue(data.fixedHeight) : true,
      crossFade: false,
      coverflowEffect: getCoverflowEffect(data, this.settings, useEffect),
      effect: useEffect,
      pagination: getPaginationSettings(this, data, this.settings),
      slidesPerView: parseAttributeValue(data.slidesPerView) || 1,
      centeredSlides: parseAttributeValue(data.centeredSlides) || false,
      spaceBetween: data.spaceBetween || 0,
      breakpoints: {
        // Mobile - when window width is >= 0px
        0: {
          slidesPerView: parseAttributeValue(data.mobileSlidesPerView) || 1,
          centeredSlides: data.centeredSlides 
              ? parseAttributeValue(data.mobileSlidesPerView) === 1 
              ? false 
              : parseAttributeValue(data.centeredSlides) 
              : false,
          spaceBetween: parseAttributeValue(data.mobileSpaceBetween) || parseAttributeValue(data.spaceBetween) || 0,
        },
        // Tablet - when window width is >= 767px
        767: {
          slidesPerView: parseAttributeValue(data.tabletSlidesPerView) || parseAttributeValue(data.slidesPerView) || 1,
          centeredSlides: data.centeredSlides 
            ? parseAttributeValue(data.tabletSlidesPerView) === 1 
            ? false 
            : parseAttributeValue(data.centeredSlides) 
            : false,
          spaceBetween: parseAttributeValue(data.tabletSpaceBetween) || parseAttributeValue(data.spaceBetween) || 0,
        },
        // Desktop - when window width is >= 1024px
        1024: {
          slidesPerView: parseAttributeValue(data.slidesPerView) || 1,
          centeredSlides: data.centeredSlides 
            ? parseAttributeValue(data.slidesPerView) === 1 
            ? false 
            : parseAttributeValue(data.centeredSlides) 
            : false,
          spaceBetween: parseAttributeValue(data.spaceBetween) || 0,
        },
      },
    });

    function getPaginationSettings(self, data, settings) {
      const render = (index, className) => {
        return '<span class="numbered-bullet ' + className + '">' + (index + 1) + "</span>";
      };
      return {
        el: self.el.querySelector(".swiper-pagination"),
        clickable: parseAttributeValue(data.paginationClickable) || true,
        dynamicBullets: parseAttributeValue(data.dynamicBullets) || false,
        renderBullet: settings[parseAttributeValue(data.renderBullet)] || render,
      };
    }
    function parseAttributeValue(value) {
      if (value === "true") return true;
      if (value === "false") return false;
      const number = parseFloat(value);
      if (!isNaN(number) && number.toString() === value) return number;
      return value;
    }
    function getCoverflowEffect(data, settings, activeEffect) {
      if (activeEffect !== "coverflow") {
        return false;
      }
      return {
        depth: settings.coverflow?.depth ?? 100,
        rotate: settings.coverflow?.rotate ?? 50,
        scale: settings.coverflow?.scale ?? 0.9,
        slideShadows: settings.coverflow?.slideShadows ?? true,
      };
    }
    function getAutoplaySettings(data, settings) {
      const timer = parseAttributeValue(data.autoplayTimer);
      const loop = data.loop ? parseAttributeValue(data.loop) : true;
      const stopOnLastSlide = loop ? false : true;
      if (!timer) {
        return false;
      }

      return {
        delay: timer,
        stopOnLastSlide: stopOnLastSlide,
        disableOnInteraction: parseAttributeValue(data.autoplayDisableOnInteraction) || settings.autoplayDisableOnInteraction || false,
      };
    }
  }
  _parseAttributeValue(value) {
    if (value === "true") return true;
    if (value === "false") return false;
    const number = parseFloat(value);
    if (!isNaN(number) && number.toString() === value) return number;
    return value;
  }
}

(function () {
  class Utilities {
    static deepMerger(...objs) {
      function getType(obj) {
        return Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
      }
      function mergeObj(clone, obj) {
        for (let [key, value] of Object.entries(obj)) {
          let type = getType(value);
          if (type === "object" || type === "array") {
            if (clone[key] === undefined) {
              clone[key] = type === "object" ? {} : [];
            }
            mergeObj(clone[key], value); // Corrected recursive call
          } else if (type === "function") {
            clone[key] = value; // Directly reference the function
          } else {
            clone[key] = value;
          }
        }
      }
      if (objs.length === 0) {
        return {};
      }
      let clone = {};
      objs.forEach(obj => {
        mergeObj(clone, obj);
      });
      return clone;
    }
    static emitEvent(type, detail = {}, elem = document) {
      // Make sure there's an event type
      if (!type) return;

      // Create a new event
      let event = new CustomEvent(type, {
        bubbles: true,
        cancelable: true,
        detail: detail,
      });

      // Dispatch the event
      return elem.dispatchEvent(event);
    }
    static parseAttributeValue(value) {
      if (value === "true") return true;
      if (value === "false") return false;
      const number = parseFloat(value);
      if (!isNaN(number) && number.toString() === value) return number;
      return value;
    }
  }
  class ScriptLoader {
    static siteBundleSelector = 'script[src*="https://static1.squarespace.com/static/vta"]';
    static async reloadSiteBundle() {
      const siteBundle = document.querySelector(ScriptLoader.siteBundleSelector);
      await ScriptLoader.loadScript(siteBundle.src);
    }

    static async fromElements(els) {
      const scriptsToLoad = new Set();
      const inlineScriptsToExecute = [];

      // Step 1: Collect and filter scripts
      els.forEach(el => {
        el.querySelectorAll("script").forEach(script => {
          if (script.src) {
            scriptsToLoad.add(script.src);
          } else if (!script.src && script.type !== "application/json") {
            inlineScriptsToExecute.push(script.textContent || script.innerText);
          }
        });

        // Directly check and load scripts if needed
        if (el.querySelector(".sqs-video-background-native") || el.querySelector(".page-section.user-items-list-section") || el.querySelector(".page-section.gallery-section") || el.querySelector(".background-fx-canvas")) {
          const siteBundle = document.querySelector(ScriptLoader.siteBundleSelector);
          scriptsToLoad.add(siteBundle.src);
        }
      });

      // Step 2: Load external scripts
      await Promise.all(Array.from(scriptsToLoad).map(src => this.loadScript(src)));

      // Step 3: Execute inline scripts
      inlineScriptsToExecute.forEach(scriptContent => {
        this.executeInlineScript(scriptContent);
      });
    }
    static loadScript(scriptSrc, async = true) {
      return new Promise((resolve, reject) => {
        if (document.querySelector(ScriptLoader.siteBundleSelector)) {
          document.querySelector(ScriptLoader.siteBundleSelector).remove();
        }

        const script = document.createElement("script");
        script.id = "reloaded";
        script.src = scriptSrc;
        script.async = async;
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });
    }
    static executeInlineScript(scriptContent) {
      // Consider creating a sandboxed environment for execution if possible
      // Alternatively, ensure the content is from a trusted source
      try {
        new Function(scriptContent)();
      } catch (error) {
        console.error("Error executing inline script:", error);
      }
    }
    static async duplicateRootCssRule() {
      const hasStyle = document.querySelector("style#wm-root-theme-duplicate");
      if (hasStyle) return;

      try {
        // Fetch the CSS file
        const response = await fetch("/site.css");
        const cssText = await response.text();

        // Parse the CSS to find the second :root rule
        const cssRules = cssText.split("}").map(rule => rule.trim() + "}"); // Split and reassemble CSS rules
        const rootRules = cssRules.filter(rule => rule.startsWith(":root"));
        if (rootRules.length < 2) {
          console.error("Second :root rule not found");
          return;
        }

        // Duplicate and modify the rule
        const newRuleText = rootRules[1].replace(":root", '[data-section-theme="white"]');

        // Append the new rule as an internal style sheet
        const styleTag = document.createElement("style");
        styleTag.textContent += newRuleText; // Use += in case you want to append multiple rules
        styleTag.dataset.description = "Duplicated of the :root Color Theme styles";
        styleTag.id = "wm-root-theme-duplicate";
        document.head.prepend(styleTag);
      } catch (error) {
        console.error("Error fetching or duplicated :root CSS rule", error);
      }
    }
    static loadShapeBlocks(els) {
      if (document.querySelector("style#wm-shape-block-styles")) return;
      for (let el of els) {
        if (el.querySelector('[data-definition-name="website.components.shape"]')) {
          addShapeBlockStyles();
          break; // Exit after adding styles once
        }
      }

      function addShapeBlockStyles() {
        const styleContent = `
          .sqs-block[data-definition-name="website.components.shape"] svg.sqs-shape {
            fill: var(--shape-block-background-color);
            stroke: var(--shape-block-stroke-color);
          }
          .sqs-block[data-definition-name="website.components.shape"] .sqs-shape-rectangle {
            background: var(--shape-block-background-color);
            border-color: var(--shape-block-stroke-color);
          }
          .sqs-block[data-definition-name="website.components.shape"] .sqs-block-content,
          .sqs-block[data-definition-name="website.components.shape"] .sqs-block-alignment-wrapper {
            height: 100%;
          }
          .sqs-block[data-definition-name="website.components.shape"] .sqs-block-alignment-wrapper {
            display: flex;
          }
          .sqs-block[data-definition-name="website.components.shape"] .sqs-shape {
            display: block;
            position: absolute;
            overflow: visible;
          }
          .sqs-block[data-definition-name="website.components.shape"] .sqs-shape-block-container {
            position: relative;
            color: var(--shape-block-dropshadow-color);
          }`;

        const styleElement = document.createElement("style");
        styleElement.id = "wm-shape-block-styles";
        styleElement.type = "text/css";
        styleElement.appendChild(document.createTextNode(styleContent));
        document.head.appendChild(styleElement);
      }
    }
  }

  function deconstruct() {
    document.querySelectorAll(".wm-section-slider").forEach(swiper => {
      swiper.swiper?.destroy();
      swiper.outerHTML = swiper.querySelector(".swiper-wrapper").innerHTML; // Restore original HTML
    });
    document.querySelectorAll(".swiper-slide").forEach(slide => {
      slide.outerHTML = slide.innerHTML;
    });
    ScriptLoader.reloadSiteBundle();
  }
  function addDeconstructListener() {
    // Observe changes to the body's class attribute
    const bodyObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.attributeName === "class") {
          const classList = document.body.classList;
          if (classList.contains("sqs-edit-mode-active")) {
            deconstruct();
            bodyObserver?.disconnect();
          }
        }
      });
    });

    bodyObserver.observe(document.body, {
      attributes: true,
    });
  }
  function afterInit() {
    /*Check If Need to rerun SiteBundle*/
    const sliders = window[nameSpace].items;
    for (let slider of sliders) {
      if (slider.querySelector(".sqs-video-background-native") || slider.querySelector(".page-section.user-items-list-section") || slider.querySelector(".page-section.gallery-section") || slider.querySelector(".background-fx-canvas")) {
        ScriptLoader.reloadSiteBundle();
      }
    }
  }

  function buildPlugin(el, settings) {
    const initialSection = el.closest(".page-section");
    const sectionsCount = el.dataset.slides || 3;
    const pagination = el.dataset.pagination ? Utilities.parseAttributeValue(el.dataset.pagination) : true;
    const navigation = el.dataset.navigation ? Utilities.parseAttributeValue(el.dataset.navigation) : true;
    const isStatic = el.dataset.static ? Utilities.parseAttributeValue(el.dataset.static) : false;
    // Opt-in only: don't auto-inject the toggle into existing sites. Owners
    // must set data-autoplay-toggle="true" to display it.
    const showAutoplayToggle = el.dataset.autoplayTimer && Utilities.parseAttributeValue(el.dataset.autoplayToggle) === true;
    const id = el.id;
    const colorTheme = initialSection.dataset.sectionTheme;
    const tweaks = window.Static?.SQUARESPACE_CONTEXT?.tweakJSON;

    initialSection.insertAdjacentHTML(
      "beforebegin",
      `<section 
          data-section-theme="${colorTheme}"
          data-header-transparent="${tweaks && tweaks["tweak-transparent-header"]}"
          class="swiper page-section wm-section-slider"${id ? ` id="${id}"` : ``}>
        <div class="swiper-wrapper">
        </div>
        ${pagination && navigation !== "inline" ? `<div class="swiper-pagination"></div>` : ``}
        ${
          navigation && navigation !== "inline"
            ? `<div class="navigation-wrapper">
          <div class="navigation-button-prev">
            <button>
              <div class="swiper-button-background"></div>
              ${settings.prevIcon}
            </button>
          </div>
          <div class="navigation-button-next">
            <button>
              <div class="swiper-button-background"></div>
              ${settings.nextIcon}
            </button>
          </div>
        </div>`
            : ``
        }
        ${
          navigation === "inline" && pagination === "inline"
            ? `<div class="inline-navigation-wrapper">
          <div class="navigation-button-prev">
            <button>
              <div class="swiper-button-background"></div>
              ${settings.prevIcon}
            </button>
          </div>
          <div class="swiper-pagination"></div>
          <div class="navigation-button-next">
            <button>
              <div class="swiper-button-background"></div>
              ${settings.nextIcon}
            </button>
          </div>
        </div>`
            : ``
        }
        ${showAutoplayToggle ? `<div class="wm-slider-autoplay-toggle">
          <button aria-label="Pause slideshow" data-playing="true">
            <svg class="wm-slider-icon-pause" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <rect x="6" y="4" width="4" height="16"/>
              <rect x="14" y="4" width="4" height="16"/>
            </svg>
            <svg class="wm-slider-icon-play" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <polygon points="6,4 20,12 6,20"/>
            </svg>
          </button>
        </div>` : ``}
      </section>`
    );

    const swiper = initialSection.previousElementSibling;
    const swiperWrapper = swiper.querySelector(".swiper-wrapper");

    let nextSection = initialSection;
    for (let i = 0; i < sectionsCount; i++) {
      if (!nextSection) break; // Break if there are no more sibling sections

      if (i == 0 && isStatic == "background") {
        swiper.dataset.static = "background";
        nextSection.classList.add("static-slide");
        swiper.appendChild(nextSection);
      } else if (i == 0 && isStatic === "content") {
        swiper.dataset.static = "content";
        nextSection.classList.add("static-slide");
        swiper.prepend(nextSection);
      } else {
        const slide = document.createElement("div");
        slide.classList.add("swiper-slide");
        slide.appendChild(nextSection);
        swiperWrapper.appendChild(slide);
      }

      nextSection = swiper.nextElementSibling; // Move to the next sibling
    }
    return swiper;
  }

  // Utility or helper functions
  async function initPlugin() {
    let pluginEls = document.querySelectorAll('[data-wm-plugin="section-slider"]:not([data-loading-state])');
    if (!pluginEls.length) return;
    const settings = window[nameSpace].settings;
    ScriptLoader.duplicateRootCssRule();

    pluginEls.forEach(el => {
      if (el.closest("section.wm-section-slider") || el.closest("body.sqs-edit-mode-active")) return;
      el.setAttribute('data-loading-state', 'initializing');
      const sliderEl = buildPlugin(el, settings);
      el.wmSectionSlider = new WMSectionSlider(sliderEl, settings);
      el.setAttribute('data-loading-state', 'initialized');
      window[nameSpace].items.push(sliderEl);
    });

    Utilities.emitEvent(`${nameSpace}:ready`);
  }

  const nameSpace = "wmSectionSlider";
  const defaultSettings = {
    pauseInactiveBackgroundVideos: true,
    restartBackgroundVideos: false,
    headerColorThemeMatch: true,
    colorThemeMatch: false,
    autoplayDisableOnInteraction: false,
    prevIcon: `<svg class="user-items-list-carousel__arrow-icon" viewBox="0 0 44 18" xmlns="http://www.w3.org/2000/svg">
        <path class="user-items-list-carousel__arrow-icon-foreground user-items-list-carousel__arrow-icon-path" d="M9.90649 16.96L2.1221 9.17556L9.9065 1.39116"></path>
        <path class="user-items-list-carousel__arrow-icon-foreground user-items-list-carousel__arrow-icon-path" d="M42.8633 9.18125L3.37868 9.18125"></path>
    </svg>`,
    nextIcon: `
    <svg class="user-items-list-carousel__arrow-icon" viewBox="0 0 44 18" xmlns="http://www.w3.org/2000/svg">
      <path class="user-items-list-carousel__arrow-icon-foreground user-items-list-carousel__arrow-icon-path" d="M34.1477 1.39111L41.9321 9.17551L34.1477 16.9599"></path>
      <path class="user-items-list-carousel__arrow-icon-foreground user-items-list-carousel__arrow-icon-path" d="M1.19088 9.16982H40.6755"></path>
    </svg>`,
    coverflow: {
      depth: 100,
      rotate: 50,
      scale: 0.9,
      slideShadows: true,
      iosFallbackEffect: false, // Set to "slide", "fade", or "cards" to disable coverflow on iOS
    },
  };
  const userSettings = window.wmSectionSliderSettings || {};

  // Correctly expose the initPlugin method on the window
  window[nameSpace] = {
    init: () => {
      initPlugin();
      afterInit();
    },
    items: [],
  };
  window[nameSpace].settings = Utilities.deepMerger({}, defaultSettings, userSettings);
  window[nameSpace].scriptLoader = ScriptLoader;
  window[nameSpace].utilities = Utilities;
  window[nameSpace].deconstruct = deconstruct;

  // Now you can call the init method directly
  if (document.ready) {
    window[nameSpace].init();
    if (window.self !== window.top) addDeconstructListener();
  } else {
    window.addEventListener("DOMContentLoaded", () => {
      window[nameSpace].init();
      if (window.self !== window.top) addDeconstructListener();
    });
  }
})();
