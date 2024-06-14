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
    this.addFuncSliderColorThemeMatch()
  }
  addResizeEventListener() {
    const handleResize = () => {
      this.setHeaderHeightVariable();
    };
    window.addEventListener("resize", handleResize);
  }
  addDOMContentLoadedEventListener() {}
  addLoadEventListener() {}
  addAfterInitEventListener() {
    if (this.settings.pauseInactiveBackgroundVideos && !this.settings.restartBackgroundVideos)  {
      this.addFuncPauseInactiveBackgroundVideos()
    }
    if (this.settings.restartBackgroundVideos) {
      this.addFuncRestartBackgroundVideos();
    }
    // this.addFuncInitSectionDividers(); <-- Still working on this
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
    // necessary utility functions
    let allowEvent = false;
    const container = this.el;
    const pauseVideo = async (video) => {
      if (video.wmVimeoVideo && !video.isPaused) {
        await video.wmVimeoVideo.pause();
        video.isPaused = true;
        return;
      }
      if (video.readyState >= 2) {
        video.pause();
      } else {
        video.addEventListener('canplay', () => {
          video.pause();
        });
      }
    };
    const playVideo = async (video) => {
      if (video.wmVimeoVideo && video.isPaused) {
        //console.log(video.wmVimeoVideo.readyState)
        await video.wmVimeoVideo.play();
        video.isPaused = false;
        return;
      }
      if (video.readyState >= 2) {
        video.play();
      } else {
        video.addEventListener('canplay', () => {
          video.play();
        });
      }
    }
    const pauseAllVideos = (container) => {
      const videos = container.querySelectorAll('.section-border .sqs-video-background-native video, .section-border iframe[src*="vimeo.com"]');
      videos.forEach(pauseVideo);
    };
    const addVimeoAPI = () => {
      const script = document.createElement('script');
      script.src = "https://player.vimeo.com/api/player.js";
      document.head.prepend(script);
      script.onload = () => {
        const videos = container.querySelectorAll('.section-border iframe[src*="vimeo.com"]');
        videos.forEach(video => {
          video.wmVimeoVideo = new Vimeo.Player(video)
          video.isPaused = true;
        })
        allowEvent = true;
      }
    }


    // On slide changes
    this.swiper.on('slideChange', () => {
      if (!allowEvent) return;
      const activeSlide = this.swiper.slides[this.swiper.activeIndex]
      pauseAllVideos(container);
      const activeVideo = activeSlide.querySelector('.sqs-video-background-native video, .section-border iframe[src*="vimeo.com"]');
      if (activeVideo) playVideo(activeVideo);
    });
    
    const observer = new MutationObserver((mutationsList, observer) => {
      for(let mutation of mutationsList) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1 && node.matches('.sqs-video-background-native video')) {
              allowEvent = true;
              pauseAllVideos(container); 
              playVideo(container.querySelector('.swiper-slide-active .sqs-video-background-native video'));
              observer.disconnect(); // Disconnect after pausing videos
              return; // Exit the observer callback
            }
            if (node.nodeType === 1 && container.querySelector('iframe[src*="vimeo.com"]')) {
              addVimeoAPI();
              observer.disconnect(); // Disconnect after pausing videos
              return; // Exit the observer callback
            }
          }
        }
      }
    });

    observer.observe(container, { childList: true, subtree: true });
  }
  addFuncRestartBackgroundVideos() {
    this.swiper.on('slideChange', () => {
      this.swiper.slides.forEach((slide, index) => {
        const video = slide.querySelector('.sqs-video-background-native video');
        if (video) {
          if (index === this.swiper.activeIndex) {
            video.play();
          } else {
            video.pause();
            video.currentTime = 0;
          }
        }
      });
    });
  }
  addFuncInitSectionDividers() {
    const hasSectionDividerBefore = this.el.previousElementSibling.matches('.has-section-divider');
    const lastSlide = this.swiper.slides[this.swiper.slides.length - 1]
    const hasSectionDividerAfter = lastSlide.querySelector('.has-section-divider');

    if (hasSectionDividerBefore) {
      const firstSlide = this.el.querySelector('.page-section');
      const id = firstSlide.dataset.sectionId
      this.el.dataset.sectionId = id;
      this.el.dataset.hasPrevSectionDivider = 'true'
    }
    if (hasSectionDividerAfter) {
      const divider = lastSlide.querySelector('.section-divider-display').cloneNode(true);
      const border = lastSlide.querySelector('.section-border').cloneNode(true);
      this.el.classList.add('has-section-divider');
      this.el.append(divider)
      this.el.prepend(border)
      this.el.dataset.hasAfterSectionDivider = 'true'
    }
  }
  addFuncRandomizeSlides() {
    if (!this.initEl.dataset.randomize) return;
    const totalSlides = this.swiper.slides.length;
    const randomIndex = Math.floor(Math.random() * totalSlides);

    this.swiper.slideTo(randomIndex);
  }
  addFuncHeaderColorThemeMatch() {
    const isFirstSection = this.el.matches('#sections > *:first-child');
    const isFixedHeader = window.Static?.SQUARESPACE_CONTEXT?.tweakJSON['tweak-fixed-header'] === 'true';

    if (isFirstSection && this.settings.headerColorThemeMatch && !isFixedHeader) {
      this.swiper.on("activeIndexChange", () => {
        const colorTheme = this.activeSection.dataset.sectionTheme;
        const header = document.getElementById('header');
        header.dataset.sectionTheme = colorTheme;
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

  initSwiper() {
    const data = this.initEl.dataset;
    this.swiper = new Swiper(this.el, {
      speed: data.transitionSpeed || 400,
      navigation: {
        nextEl: ".navigation-button-next",
        prevEl: ".navigation-button-prev",
      },
      loop: parseAttributeValue(data.loop) || true,
      rewind: parseAttributeValue(data.rewind) || false,
      autoplay: getAutoplaySettings(data, this.settings),
      autoHeight: data.fixedHeight ? !parseAttributeValue(data.fixedHeight) : true,
      crossFade: false,
      coverflowEffect: getCoverflowEffect(data, this.settings),
      effect: parseAttributeValue(data.effect) || 'slide',
      pagination: getPaginationSettings(data, this.settings),
      slidesPerView: parseAttributeValue(data.slidesPerView) || 1,
      centeredSlides: parseAttributeValue(data.centeredSlides) || false,
      spaceBetween: data.spaceBetween || 0,
      breakpoints: {
        // Mobile - when window width is >= 0px
        0: {
          slidesPerView: parseAttributeValue(data.mobileSlidesPerView) || 1,
          spaceBetween: parseAttributeValue(data.mobileSpaceBetween) || parseAttributeValue(data.spaceBetween) || 0
        },
        // Tablet - when window width is >= 767px
        767: {
          slidesPerView: parseAttributeValue(data.tabletSlidesPerView) || parseAttributeValue(data.slidesPerView) || 1,
          spaceBetween: parseAttributeValue(data.tabletSpaceBetween) || parseAttributeValue(data.spaceBetween) || 0,
        },
        // Desktop - when window width is >= 1024px
        1024: {
          slidesPerView: parseAttributeValue(data.slidesPerView) || 1,
          spaceBetween: parseAttributeValue(data.spaceBetween) || 0,
        }
      }
    });

    function getPaginationSettings(data, settings) {
      const render = (index, className) => {
        return '<span class="numbered-bullet ' + className + '">' + (index + 1) + "</span>";
      };
      return {
        el: ".swiper-pagination",
        clickable: parseAttributeValue(data.paginationClickable) || true,
        dynamicBullets: parseAttributeValue(data.dynamicBullets) || false,
        renderBullet:
          settings[parseAttributeValue(data.renderBullet)] || render,
      };
    }
    function parseAttributeValue(value) {
      if (value === "true") return true;
      if (value === "false") return false;
      const number = parseFloat(value);
      if (!isNaN(number) && number.toString() === value) return number;
      return value;
    }
    function getCoverflowEffect(data, settings) {
      if (parseAttributeValue(data.effect) !== 'coverflow') {
        return false;
      }
      return {
        depth: settings.coverflow?.depth ?? 100,
        rotate: settings.coverflow?.rotate ?? 50,
        scale: settings.coverflow?.scale ?? 0.9,
        slideShadows: settings.coverflow?.slideShadows ?? true
      };
    } 
    function getAutoplaySettings(data, settings) {
      const timer = parseAttributeValue(data.autoplayTimer);
      if (!timer) {
        return false;
      }
      return {
        delay: timer,
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


(function() {
  class Utilities {
    static deepMerger(...objs) {
      function getType(obj) {
        return Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
      }
      function mergeObj(clone, obj) {
        for (let [key, value] of Object.entries(obj)) {
          let type = getType(value);
          if (type === 'object' || type === 'array') {
            if (clone[key] === undefined) {
              clone[key] = type === 'object' ? {} : [];
            }
            mergeObj(clone[key], value);  // Corrected recursive call
          } else if (type === 'function') {
            clone[key] = value;  // Directly reference the function
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
    };
    static parseAttributeValue(value) {
      if (value === "true") return true;
      if (value === "false") return false;
      const number = parseFloat(value);
      if (!isNaN(number) && number.toString() === value) return number;
      return value;
    }
  }
  class ScriptLoader {
    static siteBundleSelector = 'script[src*="https://static1.squarespace.com/static/vta"]'
    static async reloadSiteBundle() {
      const siteBundle = document.querySelector(ScriptLoader.siteBundleSelector);
      await ScriptLoader.loadScript(siteBundle.src)
    }

    
    static async fromElements(els) {
      const scriptsToLoad = new Set();
      const inlineScriptsToExecute = [];
  
      // Step 1: Collect and filter scripts
      els.forEach(el => {
        el.querySelectorAll('script').forEach(script => {
          if (script.src) {
            scriptsToLoad.add(script.src);
          } else if (!script.src && script.type !== 'application/json') {
            inlineScriptsToExecute.push(script.textContent || script.innerText);
          }
        });

        // Directly check and load scripts if needed
        if (el.querySelector('.sqs-video-background-native') ||
            el.querySelector('.page-section.user-items-list-section') ||
            el.querySelector('.page-section.gallery-section') ||
            el.querySelector('.background-fx-canvas')) {
          const siteBundle = document.querySelector(ScriptLoader.siteBundleSelector)
          scriptsToLoad.add(siteBundle.src);
        }
      });
  
      // Step 2: Load external scripts
      await Promise.all(
        Array.from(scriptsToLoad).map(src => this.loadScript(src))
      );
  
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

        const script = document.createElement('script');
        script.id = 'reloaded'
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
        console.error('Error executing inline script:', error);
      }
    }
    static async duplicateRootCssRule() {
      const hasStyle = document.querySelector('style#wm-root-theme-duplicate');
      if (hasStyle) return;
      
      try {
        // Fetch the CSS file
        const response = await fetch('/site.css');
        const cssText = await response.text();
    
        // Parse the CSS to find the second :root rule
        const cssRules = cssText.split('}').map(rule => rule.trim() + '}'); // Split and reassemble CSS rules
        const rootRules = cssRules.filter(rule => rule.startsWith(':root'));
        if (rootRules.length < 2) {
          console.error('Second :root rule not found');
          return;
        }
    
        // Duplicate and modify the rule
        const newRuleText = rootRules[1].replace(':root', '[data-section-theme="white"]');
        
        // Append the new rule as an internal style sheet
        const styleTag = document.createElement('style');
        styleTag.textContent += newRuleText; // Use += in case you want to append multiple rules
        styleTag.dataset.description = "Duplicated of the :root Color Theme styles"
        styleTag.id = "wm-root-theme-duplicate"
        document.head.prepend(styleTag);
      } catch (error) {
        console.error('Error fetching or duplicated :root CSS rule', error);
      }
    }
    static loadShapeBlocks(els) {
      if (document.querySelector('style#wm-shape-block-styles')) return;
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
          
        const styleElement = document.createElement('style');
        styleElement.id = 'wm-shape-block-styles'
        styleElement.type = 'text/css';
        styleElement.appendChild(document.createTextNode(styleContent));
        document.head.appendChild(styleElement);
      }
    }
  }
  class DataFetcher {
    static async getItemsFromCollection(path) {
      try {
        const url = new URL(path, window.location.origin); 
        const params = new URLSearchParams(url.search); 
        let isFeatured;
        if (params.has("featured")) {
          isFeatured = true; 
          params.delete("featured");
        }
  
        const date = new Date().getTime(); // Adding a cache busting parameter
        params.set("format", "json");
        params.set("date", date);
        url.search = params.toString(); // Update the search part of the URL
  
        // Make the fetch request using the updated URL
        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error(`Network response was not ok: ${response.status}`);
        }
        const data = await response.json();
        if (data.past || data.upcoming) {
          data.collectionType = "events";
        }
        if (!data.items) {
          throw new Error(`No items in the collection`);
        }
        if (isFeatured) {
          data.items = data.items.filter(item => item.starred === true);
        }
        return data; // Return the data so it can be used after await
      } catch (error) {
        console.error("Error fetching data:", error);
        throw error;
      }
    }
    static async getHTMLFromURL(url, selector = "#sections") {
      try {
        // Fetch the content from the URL
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();
  
        // Parse the HTML and extract content based on the selector
        // Create a new DOM parser
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const selectedContent = doc.querySelector(selector);
  
        // Return the outer HTML of the selected element or an empty string if not found
        return selectedContent ? selectedContent.outerHTML : "";
      } catch (error) {
        console.error("Error fetching URL:", error);
        return "";
      }
    }
    static async getCollectionItemsHTML(path) {
      const data = await DataFetcher.getItemsFromCollection(path);
      const items = data.items;
      if (items[0].recordTypeLabel == "portfolio-item") {
        const fetchPromises = items.map(item => DataFetcher.getHTMLFromURL(item.fullUrl)); 
        const contents = await Promise.all(fetchPromises); 
        items.forEach((item, index) => (item.body = contents[index]));
      }
      return data;
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
      if (slider.querySelector('.sqs-video-background-native') ||
          slider.querySelector('.page-section.user-items-list-section') ||
          slider.querySelector('.page-section.gallery-section') ||
          slider.querySelector('.background-fx-canvas')) {
        ScriptLoader.reloadSiteBundle();
      }
    }

  }

  function buildPlugin(el, settings) {
    const initialSection = el.closest(".page-section");
    const sectionsCount = el.dataset.slides || 3;
    const pagination = el.dataset.pagination
      ? Utilities.parseAttributeValue(el.dataset.pagination)
      : true;
    const navigation = el.dataset.navigation
      ? Utilities.parseAttributeValue(el.dataset.navigation)
      : true;
    const static = el.dataset.static
      ? Utilities.parseAttributeValue(el.dataset.static)
      : false;
    const id = el.id;
    const colorTheme = initialSection.dataset.sectionTheme;
    
    initialSection.insertAdjacentHTML(
      "beforebegin",
      `<section 
          data-section-theme="${colorTheme}"
          class="swiper page-section wm-section-slider"${id ? ` id="${id}"` : ``}>
        <div class="swiper-wrapper">
        </div>
        ${pagination ? `<div class="swiper-pagination"></div>` : ``}
        ${navigation ? `<div class="navigation-wrapper">
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
        </div>` : ``
        }
      </section>`
    );

    const swiper = initialSection.previousElementSibling;
    const swiperWrapper = swiper.querySelector(".swiper-wrapper");

    let nextSection = initialSection;
    for (let i = 0; i < sectionsCount; i++) {
      if (!nextSection) break; // Break if there are no more sibling sections

      if (i == 0 && static == 'background') {
        swiper.dataset.static = 'background';
        nextSection.classList.add('static-slide')
        swiper.appendChild(nextSection)
      } else if (i == 0 && static === 'content') {
        swiper.dataset.static = 'content';
        nextSection.classList.add('static-slide')
        swiper.prepend(nextSection)
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
      if (el.closest('section.wm-section-slider')) return;
      const sliderEl = buildPlugin(el, settings);
      el.wmSectionSlider = new WMSectionSlider(sliderEl, settings);
      window[nameSpace].items.push(sliderEl);
    });
  
    Utilities.emitEvent(`${nameSpace}:ready`);
  }

  const nameSpace = 'wmSectionSlider'
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
      }
    }
  const userSettings = window.wmSectionSliderSettings || {};
  
  // Correctly expose the initPlugin method on the window
  window[nameSpace] = {
    init: () => {
      initPlugin()
      afterInit();
    },
    items: [],
  };
  window[nameSpace].settings = Utilities.deepMerger({}, defaultSettings, userSettings);
  window[nameSpace].dataFetcher = DataFetcher;
  window[nameSpace].scriptLoader = ScriptLoader;
  window[nameSpace].utilities = Utilities;
  window[nameSpace].deconstruct = deconstruct;
  
  // Now you can call the init method directly
  if (document.ready) {
    window[nameSpace].init();
    if (window.self !== window.top) addDeconstructListener()
  } else {
    window.addEventListener("DOMContentLoaded", () => {
      window[nameSpace].init();
      if (window.self !== window.top) addDeconstructListener()
    })
  }

})();
