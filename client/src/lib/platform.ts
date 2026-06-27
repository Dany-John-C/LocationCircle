import { Capacitor } from '@capacitor/core'

/** True when running inside an Android or iOS native shell */
export const isNative = Capacitor.isNativePlatform()

/** 'android' | 'ios' | 'web' */
export const platform = Capacitor.getPlatform()
