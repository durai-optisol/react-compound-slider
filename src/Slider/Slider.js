import React, { Component } from 'react'
import warning from 'warning'
import PropTypes from 'prop-types'
import scaleLinear from 'd3-scale/src/linear'
import scaleQuantize from 'd3-scale/src/quantize'
import Rail from '../Rail'
import Ticks from '../Ticks'
import Tracks from '../Tracks'
import Handles from '../Handles'
import { mode1, mode2 } from './modes'
import * as utils from './utils'

const noop = () => {}

class Slider extends Component {
  constructor(props) {
    super(props)

    this.slider = null

    this.valueToPerc = scaleLinear()
    this.valueToStep = scaleQuantize()
    this.pixelToStep = scaleQuantize()

    this.state = { values: [] }

    this.onMouseMove = this.onMouseMove.bind(this)
    this.onTouchMove = this.onTouchMove.bind(this)
    this.onMove = this.onMove.bind(this)

    this.onMouseDown = this.onMouseDown.bind(this)
    this.onTouchStart = this.onTouchStart.bind(this)
    this.onStart = this.onStart.bind(this)

    this.onMouseUp = this.onMouseUp.bind(this)
    this.onTouchEnd = this.onTouchEnd.bind(this)
  }

  componentWillMount() {
    const { domain, defaultValues, step, reversed } = this.props

    this.updateRange(domain, step, reversed)
    this.setState(this.getValues(defaultValues, reversed))
  }

  componentWillReceiveProps(next) {
    const { domain, step, reversed } = next
    const props = this.props

    if (
      domain[0] !== props.domain[0] ||
      domain[1] !== props.domain[1] ||
      step !== props.step ||
      reversed !== props.reversed
    ) {
      this.updateRange(domain, step, reversed)
    }
  }

  getValues(arr, reversed) {
    const values = []

    const mapped = arr
      .map((val, i) => ({ key: `$$-${i}`, val }))
      .sort(utils.getSortByVal(reversed))

    mapped.forEach(({ key, val }) => {
      const v0 = this.valueToStep(val)

      warning(
        v0 === val,
        `React Electric Slide: Invalid default value. Changing ${val} to ${v0}.`,
      )

      values.push({ key, val: v0 })
    })

    return { values }
  }

  updateRange([min, max], step, reversed) {
    const range = utils.getStepRange(min, max, step)

    this.valueToStep
      .range(range.slice())
      .domain([min - step / 2, max + step / 2])

    if (reversed === true) {
      this.valueToPerc.domain([min, max]).range([100, 0])
      range.reverse()
    } else {
      this.valueToPerc.domain([min, max]).range([0, 100])
    }

    this.pixelToStep.range(range)

    warning(
      max > min,
      `React Electric Slide: Max must be greater than min (even if reversed). Max is ${max}. Min is ${min}.`,
    )

    warning(
      range.length <= 10001,
      `React Electric Slide: Increase step value. Found ${range.length.toLocaleString()} values in range.`,
    )

    const last = range.length - 1

    warning(
      range[reversed ? last : 0] === min && range[reversed ? 0 : last] === max,
      `React Electric Slide: The range is incorrectly calculated. Check domain (min, max) and step values.`,
    )
  }

  onMouseDown(e, key) {
    this.onStart(e, key, false)
  }

  onTouchStart(e, key) {
    if (utils.isNotValidTouch(e)) {
      return
    }
    this.onStart(e, key, true)
  }

  onStart(e, key, isTouch) {
    const { values } = this.state

    e.stopPropagation()
    e.preventDefault()

    const active = values.find(value => {
      return value.key === key
    })

    if (active) {
      this.active = key
      isTouch ? this.addTouchEvents() : this.addMouseEvents()
    } else {
      this.active = null
      this.requestMove(e, isTouch)
    }
  }

  requestMove(e, isTouch) {
    const { state: { values: prev }, props: { vertical, reversed } } = this
    const { slider } = this

    this.pixelToStep.domain(utils.getSliderDomain(slider, vertical))

    let step

    if (isTouch) {
      step = this.pixelToStep(utils.getTouchPosition(vertical, e))
    } else {
      step = this.pixelToStep(vertical ? e.clientY : e.pageX)
    }

    let active = null
    let lowest = Infinity

    for (let i = 0; i < prev.length; i++) {
      const diff = Math.abs(this.valueToStep(prev[i].val) - step)

      if (diff < lowest) {
        active = prev[i].key
        lowest = diff
      }
    }

    if (active) {
      const next = utils.updateValues(prev, active, step, reversed)
      this.onMove(prev, next, true)
    }
  }

  addMouseEvents() {
    document.addEventListener('mousemove', this.onMouseMove)
    document.addEventListener('mouseup', this.onMouseUp)
  }

  addTouchEvents() {
    document.addEventListener('touchmove', this.onTouchMove)
    document.addEventListener('touchend', this.onTouchEnd)
  }

  onMouseMove(e) {
    const { state: { values: prev }, props: { vertical, reversed } } = this
    const { active, slider } = this

    this.pixelToStep.domain(utils.getSliderDomain(slider, vertical))

    const step = this.pixelToStep(vertical ? e.clientY : e.pageX)
    const next = utils.updateValues(prev, active, step, reversed)

    this.onMove(prev, next)
  }

  onTouchMove(e) {
    const { state: { values: prev }, props: { vertical, reversed } } = this
    const { active, slider } = this

    if (utils.isNotValidTouch(e)) {
      return
    }

    this.pixelToStep.domain(utils.getSliderDomain(slider, vertical))

    const step = this.pixelToStep(utils.getTouchPosition(vertical, e))
    const next = utils.updateValues(prev, active, step, reversed)

    this.onMove(prev, next)
  }

  onMove(prev, next, submit) {
    const { mode, onUpdate, onChange } = this.props

    if (next !== prev) {
      let values

      switch (mode) {
        case 1:
          values = mode1(prev, next)
          break
        case 2:
          values = mode2(prev, next)
          break
        default:
          values = next
          warning(false, 'React Electric Slide: Invalid mode value.')
      }

      onUpdate(values.map(d => d.val))

      if (submit) {
        onChange(values.map(d => d.val))
      }

      this.setState({ values })
    }
  }

  onMouseUp() {
    const { state: { values }, props: { onChange } } = this
    onChange(values.map(d => d.val))

    document.removeEventListener('mousemove', this.onMouseMove)
    document.removeEventListener('mouseup', this.onMouseUp)
  }

  onTouchEnd() {
    const { state: { values }, props: { onChange } } = this
    onChange(values.map(d => d.val))

    document.removeEventListener('touchmove', this.onTouchMove)
    document.removeEventListener('touchend', this.onTouchEnd)
  }

  render() {
    const { state: { values }, props: { className, rootStyle } } = this

    const handles = values.map(({ key, val }) => {
      return { id: key, value: val, percent: this.valueToPerc(val) }
    })

    const children = React.Children.map(this.props.children, child => {
      if (
        child.type === Rail ||
        child.type === Ticks ||
        child.type === Tracks ||
        child.type === Handles
      ) {
        return React.cloneElement(child, {
          scale: this.valueToPerc,
          handles,
          emitMouse: this.onMouseDown,
          emitTouch: this.onTouchStart,
        })
      }

      return child
    })

    return (
      <div
        style={rootStyle || {}}
        className={className}
        ref={d => (this.slider = d)}
      >
        {children}
      </div>
    )
  }
}

Slider.propTypes = {
  /**
   * CSS class name applied to the root div of the slider.
   */
  className: PropTypes.string,
  /**
   * An object with any inline styles you want applied to the root div.
   */
  rootStyle: PropTypes.object,
  /**
   * Two elment array of numbers providing the min and max values for the slider [min, max] e.g. [0, 100].
   * It does not matter if the slider is reversed on the screen, domain is always [min, max] with min < max.
   */
  domain: PropTypes.array,
  /**
   * An array of numbers. You can supply one for a value slider, two for a range slider or more to create n-handled sliders.
   * The default values should correspond to valid step values in the domain.
   * The numbers will be forced into the domain if they are two small or large.
   */
  defaultValues: PropTypes.array,
  /**
   * The step value for the slider.
   */
  step: PropTypes.number,
  /**
   * The interaction mode. Value of 1 will allow handles to cross.
   * Value of 2 will keep the sliders from crossing and separated by a step.
   */
  mode: PropTypes.oneOf([1, 2]),
  /**
   * Set to true if the slider is displayed vertically to tell the slider to use the height to calculate positions. 
   */
  vertical: PropTypes.bool,
  /**
   * Reverse the display of slider values.
   */
  reversed: PropTypes.bool,
  /**
   * Function called with the values at each update (caution: high-volume updates when dragging).
   */
  onUpdate: PropTypes.func,
  /**
   * Function called with the values when interaction stops.
   */
  onChange: PropTypes.func,
  /**
   * Component children to render
   */
  children: PropTypes.any,
}

Slider.defaultProps = {
  mode: 1,
  step: 0.1,
  domain: [0, 100],
  vertical: false,
  reversed: false,
  onUpdate: noop,
  onChange: noop,
}

export default Slider
