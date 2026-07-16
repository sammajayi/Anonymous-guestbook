import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  authorSecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  storeMessage(context: __compactRuntime.CircuitContext<PS>,
               customMessage_0: string): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  storeMessage(context: __compactRuntime.CircuitContext<PS>,
               customMessage_0: string): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  authorCommitment(sk_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  authorCommitment(context: __compactRuntime.CircuitContext<PS>,
                   sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  storeMessage(context: __compactRuntime.CircuitContext<PS>,
               customMessage_0: string): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  entries: {
    isEmpty(): boolean;
    length(): bigint;
    head(): { is_some: boolean, value: { message: string, author: Uint8Array } };
    [Symbol.iterator](): Iterator<{ message: string, author: Uint8Array }>
  };
  readonly postCount: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
