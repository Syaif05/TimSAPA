import test from 'node:test'
import assert from 'node:assert/strict'
import { reportPeriodAt, cleanReportDesign } from '../src/utils/reportDesign.js'
test('report period uses inclusive minute boundaries in WIB independently of host timezone', () => {
 for (const [time,period] of [['00:00','Malam'],['06:59','Malam'],['07:00','Pagi'],['14:00','Pagi'],['14:01','Sore'],['18:00','Sore'],['18:01','Malam'],['23:59','Malam']]) assert.equal(reportPeriodAt(new Date(`2026-11-05T${time}:59+07:00`)),period,time)
})
test('older shared designs enable automatic time by default while manual choice can be saved', () => {
 assert.equal(cleanReportDesign({period:'Siang'}).periodAutomatic,true)
 const manual=cleanReportDesign({period:'Pagi',periodAutomatic:false})
 assert.equal(manual.periodAutomatic,false)
 assert.equal(manual.period,'Pagi')
})
