+ws

@               ::= Block

Block           ::= Chunk
Chunk           ::= (Stat ';'?)* (LastStat ';'?)?

Stat            ::= Assign | FunctionCall | Do | While | Repeat | If | NumericFor | GenericFor | GlobalFunction | LocalFunction | LocalAssign
Assign          ::= VarList '=' ExpList
Do              ::= 'do' Block 'end'
While           ::= 'while' Exp 'do' Block  'end'
Repeat          ::= 'repeat' Block 'until' Exp
If              ::= 'if' Exp 'then' Block ( 'elseif' Exp 'then' Block )* ( 'else' Block )? 'end'
NumericFor      ::= 'for' Name '=' Exp ',' Exp ( ',' Exp )? 'do' Block 'end'
GenericFor      ::= 'for' NameList 'in' ExpList 'do' Block 'end'
GlobalFunction  ::= 'function' FuncName FuncBody
LocalFunction   ::= 'local' 'function' Name FuncBody
LocalAssign     ::= 'local' NameList ( '=' ExpList )?
LastStat        ::= 'return' ( ExpList )? | 'break'

VarList         ::= Var ( ',' Var )*
NameList        ::= Name ( ',' Name )*
ExpList         ::= Exp ( ',' Exp )*

Exp              ::= _SimpleExp  ( BinOp  _SimpleExp )*
_SimpleExp       ::= 'nil' | 'false' | 'true' | @number | @string | '...' | Function | _PrefixExp | TableConstructor | ( UnOp  _SimpleExp )
_PrefixExp       ::= ( Name:var | _PrefixExpParens ) ( _PrefixExpSquare:var | _PrefixExpDot:var | _PrefixExpArgs:call | _PrefixExpColon:call )*
_PrefixExpParens ::= '(' Exp ')'
_PrefixExpSquare ::= '[' Exp ']'
_PrefixExpDot    ::= '.' @ident
_PrefixExpArgs   ::= Args
_PrefixExpColon  ::= ':' @ident _PrefixExpArgs

// solving the left recursion problem
Var             ::= _PrefixExp // -> named('var')
FunctionCall    ::= _PrefixExp // -> named('call')

Function        ::= 'function' FuncBody
FuncBody        ::= '(' ParList? ')' Block 'end'
FuncName        ::= Name _PrefixExpDot* (':' @ident)?
Args            ::= '(' ExpList? ')' | TableConstructor | @string
ParList         ::= NameList ( ',' '...' )? | '...'

TableConstructor ::= '{' FieldList? '}'
FieldList        ::= Field  ( FieldSep  Field )* FieldSep?
Field            ::= _FieldSquare | _FieldID | _FieldExp
_FieldSquare     ::= '[' Exp ']' '=' Exp
_FieldID         ::= @ident '=' Exp
_FieldExp        ::= Exp
                     
FieldSep        ::= ',' | ';'

BinOp           ::= '|' | '-' | '\\' | '/' | '^' | '%' | '..' | '<' | '<=' | '>' | '>=' | '==' | '~='  | 'and' | 'or'
UnOp            ::= '-' | 'not' | '#'

Name            ::= @ident
