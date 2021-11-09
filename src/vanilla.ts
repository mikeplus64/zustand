export type State = object

export type StateSelector<T extends State, U> = (state: T) => U
export type EqualityChecker<T> = (state: T, newState: T) => boolean
export type StateListener<T> = (state: T, previousState: T) => void
export type StateSliceListener<T> = (slice: T, previousSlice: T) => void
export type Subscribe<T extends State> = {
  (listener: StateListener<T>): () => void
  /**
   * @deprecated Please use `subscribeWithSelector` middleware
   */
  <StateSlice>(
    listener: StateSliceListener<StateSlice>,
    selector?: StateSelector<T, StateSlice>,
    equalityFn?: EqualityChecker<StateSlice>
  ): () => void
}

export type SetState<T extends State> = {
  /**
   * NOTE The TypeScript option `exactOptionalPropertyTypes` must be set to true
   * for correct typings for partial state updates. This option is only
   * available with TypeScript 4.4+.
   */
  (nextState: Partial<T> | ((state: T) => Partial<T>), replace?: false): void
  (nextState: T | ((state: T) => T), replace: true): void
}
export type GetState<T extends State> = () => T
export type Destroy = () => void
export type StoreApi<T extends State> = {
  setState: SetState<T>
  getState: GetState<T>
  subscribe: Subscribe<T>
  destroy: Destroy
}
export type StateCreator<
  T extends State,
  CustomSetState = SetState<T>,
  CustomGetState = GetState<T>,
  CustomStoreApi extends StoreApi<T> = StoreApi<T>
> = (set: CustomSetState, get: CustomGetState, api: CustomStoreApi) => T

export default function create<
  TState extends State,
  CustomSetState = SetState<TState>,
  CustomGetState = GetState<TState>,
  CustomStoreApi extends StoreApi<TState> = StoreApi<TState>
>(
  createState: StateCreator<
    TState,
    CustomSetState,
    CustomGetState,
    CustomStoreApi
  >
): CustomStoreApi {
  let state: TState
  const listeners: Set<StateListener<TState>> = new Set()

  const setState: SetState<TState> = (
    getNextState:
      | Partial<TState>
      | TState
      | ((state: TState) => Partial<TState> | TState),
    replace?: boolean
  ) => {
    // TODO: Remove type assertion once https://github.com/microsoft/TypeScript/issues/37663 is resolved
    // https://github.com/microsoft/TypeScript/issues/37663#issuecomment-759728342
    const nextState =
      typeof getNextState === 'function'
        ? (getNextState as (state: TState) => TState)(state)
        : getNextState
    if (nextState !== state) {
      const previousState = state
      state = replace
        ? (nextState as TState)
        : Object.assign({}, state, nextState)
      listeners.forEach((listener) => listener(state, previousState))
    }
  }

  const getState: GetState<TState> = () => state

  const subscribeWithSelector = <StateSlice>(
    listener: StateSliceListener<StateSlice>,
    selector: StateSelector<TState, StateSlice> = getState as any,
    equalityFn: EqualityChecker<StateSlice> = Object.is
  ) => {
    console.warn('[DEPRECATED] Please use `subscribeWithSelector` middleware')
    let currentSlice: StateSlice = selector(state)
    function listenerToAdd() {
      const nextSlice = selector(state)
      if (!equalityFn(currentSlice, nextSlice)) {
        const previousSlice = currentSlice
        listener((currentSlice = nextSlice), previousSlice)
      }
    }
    listeners.add(listenerToAdd)
    // Unsubscribe
    return () => listeners.delete(listenerToAdd)
  }

  const subscribe: Subscribe<TState> = <StateSlice>(
    listener: StateListener<TState> | StateSliceListener<StateSlice>,
    selector?: StateSelector<TState, StateSlice>,
    equalityFn?: EqualityChecker<StateSlice>
  ) => {
    if (selector || equalityFn) {
      return subscribeWithSelector(
        listener as StateSliceListener<StateSlice>,
        selector,
        equalityFn
      )
    }
    listeners.add(listener as StateListener<TState>)
    // Unsubscribe
    return () => listeners.delete(listener as StateListener<TState>)
  }

  const destroy: Destroy = () => listeners.clear()
  const api = { setState, getState, subscribe, destroy }
  state = createState(
    setState as unknown as CustomSetState,
    getState as unknown as CustomGetState,
    api as unknown as CustomStoreApi
  )
  return api as unknown as CustomStoreApi
}
