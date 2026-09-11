import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function initGlobalGsapAnimations() {
  if (typeof window === 'undefined') return;

  // -------------------------------------------------------------
  // 1. HERO SECTION
  // -------------------------------------------------------------
  const heroTitle = document.querySelector('.hero__title');
  const heroBadge = document.querySelector('.hero__badge');
  const heroGlassCard = document.querySelector('.hero .glass-card');
  const heroMarkers = document.querySelectorAll('.hero__service-marker');

  if (heroTitle) {
    gsap.fromTo(
      heroTitle,
      { opacity: 0, y: 50 },
      { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out', delay: 0.2 }
    );
  }

  if (heroBadge) {
    gsap.fromTo(
      heroBadge,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 1, ease: 'power3.out', delay: 0.1 }
    );
  }

  if (heroGlassCard) {
    gsap.fromTo(
      heroGlassCard,
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out', delay: 0.4 }
    );
  }

  if (heroMarkers.length) {
    gsap.fromTo(
      heroMarkers,
      { opacity: 0 },
      { opacity: 0.5, duration: 1.5, ease: 'power2.out', delay: 0.5 }
    );
  }

  // -------------------------------------------------------------
  // 2. SECTION 02: STARTING POINTS
  // -------------------------------------------------------------
  const spBar = document.querySelector('.starting-points__bar');
  const spDivider = document.querySelector('.starting-points__divider');
  const spHeader = document.querySelector('.starting-points__header');
  const spCards = document.querySelectorAll('.starting-points__card');
  const spMedia = document.querySelector('.starting-points__media');

  if (spBar && spDivider) {
    gsap.fromTo(
      spBar,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: spBar, start: 'top 88%' }
      }
    );
    gsap.fromTo(
      spDivider,
      { scaleX: 0, transformOrigin: 'left center' },
      {
        scaleX: 1,
        duration: 1.1,
        ease: 'power3.inOut',
        scrollTrigger: { trigger: spDivider, start: 'top 88%' }
      }
    );
  }

  if (spHeader) {
    gsap.fromTo(
      spHeader,
      { opacity: 0, y: 35 },
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: spHeader, start: 'top 85%' }
      }
    );
  }

  if (spCards.length) {
    gsap.fromTo(
      spCards,
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.starting-points__list', start: 'top 85%' }
      }
    );
  }

  if (spMedia) {
    gsap.fromTo(
      spMedia,
      { opacity: 0, scale: 0.96 },
      {
        opacity: 1,
        scale: 1,
        duration: 1.1,
        ease: 'power3.out',
        scrollTrigger: { trigger: spMedia, start: 'top 85%' }
      }
    );
  }

  // -------------------------------------------------------------
  // 3. SECTION 03: NEW CONSTRUCTION
  // -------------------------------------------------------------
  const constrBar = document.querySelector('.construction__bar');
  const constrHeading = document.querySelector('.construction__heading-block');
  const constrFeatures = document.querySelectorAll('.construction__feature-item');
  const constrPhotoYard = document.querySelector('.construction__photo-box--yard img');

  if (constrBar) {
    gsap.fromTo(
      constrBar,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: constrBar, start: 'top 88%' }
      }
    );
  }

  if (constrHeading) {
    gsap.fromTo(
      constrHeading,
      { opacity: 0, y: 35 },
      {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: { trigger: constrHeading, start: 'top 85%' }
      }
    );
  }

  if (constrFeatures.length) {
    gsap.fromTo(
      constrFeatures,
      { opacity: 0, y: 25 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.construction__features-grid', start: 'top 85%' }
      }
    );
  }

  if (constrPhotoYard) {
    gsap.fromTo(
      constrPhotoYard,
      { yPercent: -8 },
      {
        yPercent: 8,
        ease: 'none',
        scrollTrigger: {
          trigger: constrPhotoYard.parentElement,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1.2
        }
      }
    );
  }

  // -------------------------------------------------------------
  // 4. SECTION 04: SINGLE POINT OF CONTACT
  // -------------------------------------------------------------
  const spcBar = document.querySelector('.spc-section__bar');
  const spcDivider = document.querySelector('.spc-section__divider');
  const spcTitleWords = document.querySelectorAll('.spc-section__title-row span');
  const spcAccordionItems = document.querySelectorAll('.spc-accordion__item');

  if (spcBar && spcDivider) {
    gsap.fromTo(
      spcBar,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: spcBar, start: 'top 88%' }
      }
    );
    gsap.fromTo(
      spcDivider,
      { scaleX: 0, transformOrigin: 'left center' },
      {
        scaleX: 1,
        duration: 1.1,
        ease: 'power3.inOut',
        scrollTrigger: { trigger: spcDivider, start: 'top 88%' }
      }
    );
  }

  if (spcTitleWords.length) {
    gsap.fromTo(
      spcTitleWords,
      { opacity: 0, y: 40 },
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        stagger: 0.08,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.spc-section__heading', start: 'top 85%' }
      }
    );
  }

  if (spcAccordionItems.length) {
    gsap.fromTo(
      spcAccordionItems,
      { opacity: 0, y: 25 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.spc-accordion', start: 'top 85%' }
      }
    );
  }

  // -------------------------------------------------------------
  // 5. SECTION 05: THE FINISHED STANDARD
  // -------------------------------------------------------------
  const fsBar = document.querySelector('.finished-standard__bar');
  const fsDivider = document.querySelector('.finished-standard__divider');
  const fsHeader = document.querySelector('.finished-standard__header');
  const fsCards = document.querySelectorAll('.finished-standard__nav-card');

  if (fsBar && fsDivider) {
    gsap.fromTo(
      fsBar,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: fsBar, start: 'top 88%' }
      }
    );
    gsap.fromTo(
      fsDivider,
      { scaleX: 0, transformOrigin: 'left center' },
      {
        scaleX: 1,
        duration: 1.1,
        ease: 'power3.inOut',
        scrollTrigger: { trigger: fsDivider, start: 'top 88%' }
      }
    );
  }

  if (fsHeader) {
    gsap.fromTo(
      fsHeader,
      { opacity: 0, y: 35 },
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: fsHeader, start: 'top 85%' }
      }
    );
  }

  if (fsCards.length) {
    gsap.fromTo(
      fsCards,
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.08,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.finished-standard__nav-track', start: 'top 90%' }
      }
    );
  }

  // -------------------------------------------------------------
  // 6. SECTION 06: BUDGET & SELECTIONS
  // -------------------------------------------------------------
  const bsBar = document.querySelector('.budget-selections__bar');
  const bsDivider = document.querySelector('.budget-selections__divider');
  const bsLeft = document.querySelector('.budget-selections__left');
  const bsItems = document.querySelectorAll('.budget-selections__item');

  if (bsBar && bsDivider) {
    gsap.fromTo(
      bsBar,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: bsBar, start: 'top 88%' }
      }
    );
    gsap.fromTo(
      bsDivider,
      { scaleX: 0, transformOrigin: 'left center' },
      {
        scaleX: 1,
        duration: 1.1,
        ease: 'power3.inOut',
        scrollTrigger: { trigger: bsDivider, start: 'top 88%' }
      }
    );
  }

  if (bsLeft) {
    gsap.fromTo(
      bsLeft,
      { opacity: 0, y: 35 },
      {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: { trigger: bsLeft, start: 'top 85%' }
      }
    );
  }

  if (bsItems.length) {
    gsap.fromTo(
      bsItems,
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.budget-selections__right', start: 'top 85%' }
      }
    );
  }

  // -------------------------------------------------------------
  // 7. SECTION 07 / PROCESS: FROM FIRST CALL TO FINAL APPROVAL
  // -------------------------------------------------------------
  const procBar = document.querySelector('.process-section__bar');
  const procDivider = document.querySelector('.process-section__divider');
  const procHeadingSpans = document.querySelectorAll('.process-section__heading-row span');
  const procSteps = document.querySelectorAll('.process-step');

  if (procBar && procDivider) {
    gsap.fromTo(
      procBar,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: procBar, start: 'top 88%' }
      }
    );
    gsap.fromTo(
      procDivider,
      { scaleX: 0, transformOrigin: 'left center' },
      {
        scaleX: 1,
        duration: 1.1,
        ease: 'power3.inOut',
        scrollTrigger: { trigger: procDivider, start: 'top 88%' }
      }
    );
  }

  if (procHeadingSpans.length) {
    gsap.fromTo(
      procHeadingSpans,
      { opacity: 0, y: 45 },
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        stagger: 0.07,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.process-section__heading', start: 'top 85%' }
      }
    );
  }

  if (procSteps.length) {
    gsap.fromTo(
      procSteps,
      { opacity: 0, y: 35 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.09,
        ease: 'power3.out',
        scrollTrigger: { trigger: '#process-timeline', start: 'top 85%' }
      }
    );
  }

  // -------------------------------------------------------------
  // 8. SECTION 09: FEATURED COMPLETED HOME
  // -------------------------------------------------------------
  const fhBar = document.querySelector('.featured-home-section__bar');
  const fhDivider = document.querySelector('.featured-home-section__divider');
  if (fhBar && fhDivider) {
    gsap.fromTo(
      fhBar,
      { opacity: 0, y: 25 },
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: fhBar, start: 'top 88%' }
      }
    );

    gsap.fromTo(
      fhDivider,
      { scaleX: 0, transformOrigin: 'left center' },
      {
        scaleX: 1,
        duration: 1.2,
        ease: 'power3.inOut',
        scrollTrigger: { trigger: fhDivider, start: 'top 88%' }
      }
    );
  }

  const fhTitle = document.querySelector('.featured-home-section__title');
  if (fhTitle) {
    gsap.fromTo(
      fhTitle,
      { opacity: 0, y: 40 },
      {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: { trigger: fhTitle, start: 'top 85%' }
      }
    );
  }

  const fhSpecRows = document.querySelectorAll('.featured-home-section__spec-row');
  if (fhSpecRows.length) {
    gsap.fromTo(
      fhSpecRows,
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.featured-home-section__specs', start: 'top 85%' }
      }
    );
  }

  const breakdownHeader = document.querySelector('.featured-home-section__breakdown-header');
  if (breakdownHeader) {
    gsap.fromTo(
      breakdownHeader,
      { opacity: 0, y: 40 },
      {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: { trigger: breakdownHeader, start: 'top 85%' }
      }
    );
  }

  // -------------------------------------------------------------
  // 9. SECTION 15: START THE CONVERSATION
  // -------------------------------------------------------------
  const ctaBar = document.querySelector('.start-conversation__bar');
  const ctaDivider = document.querySelector('.start-conversation__divider');
  const ctaHeader = document.querySelector('.start-conversation__header');
  const ctaLayout = document.querySelector('.start-conversation__layout');

  if (ctaBar && ctaDivider) {
    gsap.fromTo(
      ctaBar,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: ctaBar, start: 'top 88%' }
      }
    );
    gsap.fromTo(
      ctaDivider,
      { scaleX: 0, transformOrigin: 'left center' },
      {
        scaleX: 1,
        duration: 1.1,
        ease: 'power3.inOut',
        scrollTrigger: { trigger: ctaDivider, start: 'top 88%' }
      }
    );
  }

  if (ctaHeader) {
    gsap.fromTo(
      ctaHeader,
      { opacity: 0, y: 35 },
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: ctaHeader, start: 'top 85%' }
      }
    );
  }

  if (ctaLayout) {
    gsap.fromTo(
      ctaLayout,
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: { trigger: ctaLayout, start: 'top 85%' }
      }
    );
  }

  // -------------------------------------------------------------
  // 10. SECTION 16: FOOTER SLIDE-OVER OVERLAY ANIMATION
  // -------------------------------------------------------------
  const footer = document.querySelector<HTMLElement>('.site-footer');
  const prevSection = document.querySelector<HTMLElement>('.start-conversation');

  if (footer && prevSection) {
    ScrollTrigger.matchMedia({
      // Desktop & Tablet (> 768px): Smooth curtain slide-over
      '(min-width: 769px)': function () {
        ScrollTrigger.create({
          trigger: prevSection,
          start: 'bottom bottom',
          end: () => `+=${footer.offsetHeight}`,
          pin: prevSection,
          pinSpacing: false
        });
      },
      // Mobile: Clean responsive entrance
      '(max-width: 768px)': function () {
        gsap.fromTo(
          footer,
          { opacity: 0.9, y: 25 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: footer,
              start: 'top 92%'
            }
          }
        );
      }
    });
  }

  // Ensure all triggers recalculate accurate offsets once images and fonts are loaded
  ScrollTrigger.refresh();
  if (document.readyState !== 'complete') {
    window.addEventListener('load', () => {
      ScrollTrigger.refresh();
    });
  }
  setTimeout(() => ScrollTrigger.refresh(), 300);
  setTimeout(() => ScrollTrigger.refresh(), 1000);
}
