import { site } from './site.config.mjs';

// Public project information. Review wording is a draft, never an approved quote.
// Thumbnail provenance is recorded in home/design/portfolio-assets.md.
export const portfolio = [
  {
    id: 'breeze', featured: true, url: site.portfolioUrl, reviewStatus: 'draft',
    name: { en: 'Breeze Heating & Cooling', mk: 'Breeze Heating & Cooling' },
    review: {
      en: 'A smooth process, clear communication, and a website that feels right for our business.',
      mk: 'Едноставен процес, јасна комуникација и веб-страница што вистински го претставува нашиот бизнис.',
    },
  },
  {
    id: 'gmunchies', featured: false, url: 'https://gmunchiesvending.com/', reviewStatus: 'draft',
    name: { en: 'GMunchies Vending', mk: 'GMunchies Vending' },
    thumbnail: { src: '/home/portfolio/gmunchies.webp', width: 1200, height: 800, fit: 'cover' },
    category: { en: 'BUSINESS WEBSITE', mk: 'БИЗНИС ВЕБ-СТРАНИЦА' },
    description: {
      en: 'A business website presenting vending machines, office coffee and micro-markets as distinct services, with a custom CMS for content updates and a contact form for enquiries.',
      mk: 'Бизнис веб-страница со одделно претставени услуги за вендинг-автомати, канцелариско кафе и микро-маркети, прилагоден систем за уредување содржина и контакт-форма.',
    },
    tags: { en: ['Web design', 'Service pages', 'Custom CMS'], mk: ['Веб-дизајн', 'Страници за услуги', 'Прилагоден CMS'] },
    imageAlt: { en: 'GMunchies-branded vending area from the website hero artwork', mk: 'Вендинг-простор со брендот GMunchies од насловната слика на веб-страницата' },
    review: {
      en: 'A clear, professional home for our vending services, with a simple way for businesses to get in touch.',
      mk: 'Јасен и професионален настап за нашите вендинг-услуги, со едноставен начин бизнисите да стапат во контакт со нас.',
    },
  },
  {
    id: 'emilija-petrova', featured: false, url: 'http://emilijapetrova.com/', reviewStatus: 'draft',
    name: { en: 'Emilija Petrova', mk: 'Емилија Петрова' },
    thumbnail: { src: '/home/portfolio/emilija-petrova.webp', width: 801, height: 539, fit: 'contain' },
    category: { en: 'DESIGNER PORTFOLIO', mk: 'ДИЗАЈНЕРСКО ПОРТФОЛИО' },
    description: {
      en: 'A portfolio for a graphic and visual designer, with a project gallery and service information that help potential clients explore her work and approach.',
      mk: 'Портфолио за графичка и визуелна дизајнерка, со галерија на проекти и информации за услугите што им помагаат на потенцијалните клиенти да ја запознаат нејзината работа.',
    },
    tags: { en: ['Web design', 'Project gallery', 'Personal portfolio'], mk: ['Веб-дизајн', 'Галерија на проекти', 'Лично портфолио'] },
    imageAlt: { en: 'Saved homepage screenshot of Emilija Petrova’s graphic and visual design portfolio', mk: 'Зачуван приказ од почетната страница на дизајнерското портфолио на Емилија Петрова' },
    review: {
      en: 'A portfolio that gives my work room to shine and makes it easy for potential collaborators to reach me.',
      mk: 'Портфолио што ѝ дава простор на мојата работа да се истакне и им олеснува на идните соработници да стапат во контакт со мене.',
    },
  },
  {
    id: 'hendo', featured: false, url: 'https://www.thelegendofhendo.com/', reviewStatus: 'draft',
    name: { en: 'T. Hendo — Dreamstation', mk: 'T. Hendo — Dreamstation' },
    thumbnail: { src: '/home/portfolio/hendo.webp', width: 1024, height: 682, fit: 'cover' },
    category: { en: 'MUSIC & ARTIST WEBSITE', mk: 'МУЗИЧКА ВЕБ-СТРАНИЦА' },
    description: {
      en: 'An artist website with a beat catalogue and audio playback, bringing Hendo’s music and visual identity into one place where visitors can browse and listen.',
      mk: 'Веб-страница за музички артист со каталог на битови и аудио-плеер, што ги спојува музиката и визуелниот идентитет на Hendo на едно место за разгледување и слушање.',
    },
    tags: { en: ['Artist website', 'Music catalogue', 'Audio playback'], mk: ['Артистичка веб-страница', 'Музички каталог', 'Аудио-плеер'] },
    imageAlt: { en: 'Hendo’s public website artwork, a portrait in a neon-lit city street', mk: 'Промотивна слика од веб-страницата на Hendo, портрет на градска улица со неонски светла' },
    review: {
      en: 'The website brings the music and visual identity together in one place, with an easy way to explore the beats.',
      mk: 'Веб-страницата ги спојува музиката и визуелниот идентитет на едно место, со лесен начин за истражување на битовите.',
    },
  },
  {
    id: 'indoor-plants', featured: false, url: 'https://nikodola.github.io/indoor-plants/', reviewStatus: 'draft',
    name: { en: 'Indoor Plants', mk: 'Собни растенија' },
    thumbnail: { src: '/home/portfolio/indoor-plants.webp', width: 1038, height: 734, fit: 'contain' },
    category: { en: 'INTERACTIVE DIGITAL BOOKLET', mk: 'ИНТЕРАКТИВНА ДИГИТАЛНА БРОШУРА' },
    description: {
      en: 'A Macedonian-language guide to ten decorative indoor plants, combining illustrated plant profiles, care information and digital or print PDF export.',
      mk: 'Водич на македонски јазик за десет декоративни собни растенија, со илустрирани профили, информации за нега и извоз во PDF за екран или печатење.',
    },
    tags: { en: ['Digital publication', 'Responsive design', 'PDF export'], mk: ['Дигитална публикација', 'Приспособлив дизајн', 'Извоз во PDF'] },
    imageAlt: { en: 'Saved cover screenshot of the Macedonian digital booklet about ten decorative indoor plants', mk: 'Зачуван приказ од насловната страница на дигиталната брошура за десет декоративни собни растенија' },
    review: {
      en: 'The plant guide is easy to browse and thoughtfully presented, both on screen and as a printable booklet.',
      mk: 'Водичот за растенија е лесен за разгледување и внимателно претставен, и на екран и како брошура за печатење.',
    },
  },
];
