import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ar from './ar.json'
import fr from './fr.json'
import en from './en.json'
import { storageKey } from '../config/app'

const savedLang = localStorage.getItem(storageKey('lang')) || 'ar'

i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar }, fr: { translation: fr }, en: { translation: en } },
  lng: savedLang,
  fallbackLng: 'ar',
  interpolation: { escapeValue: false },
})

export default i18n
