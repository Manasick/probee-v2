export interface AuthActionState {
  ok: boolean;
  message: string;
  code?: string;
}

export const INITIAL_AUTH_STATE: AuthActionState = {
  ok: false,
  message: "",
};
