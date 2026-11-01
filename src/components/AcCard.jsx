import React from 'react'
import { AcDetailPanel } from './AcDetailPanel'

// Both layouts share the same editor, clipboard behavior and help controls.
export function AcCard(props) {
  return <AcDetailPanel {...props} compact />
}
